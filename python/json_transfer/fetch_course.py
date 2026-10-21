"""Download every subtitle in a course, starting from one SJTU play-center URL."""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from transfer import INPUT_FOLDER, OUTPUT_FOLDER, convert_file, subtitle_text

LIST_ENDPOINT = "/v1/subject_vod_list_new"
SUBTITLE_ENDPOINT = "/v1/course/ai/translate/"
SITE_HOST = "v.sjtu.edu.cn"
CANVAS_HOME = "https://oc.sjtu.edu.cn/"
RESOURCE_MANAGE_UI = f"https://{SITE_HOST}/jy-application-resourcemanage-ui/"
DEFAULT_PROFILE = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "json_transfer" / "browser_profile"


def validate_url(url):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != SITE_HOST or "/play-center" not in parsed.fragment:
        raise ValueError("请输入 v.sjtu.edu.cn 的 play-center 播放地址")
    return url


def validate_name(name):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
        raise ValueError("课程名只能包含字母、数字、下划线和短横线")
    return name


def records_from_response(payload):
    if not isinstance(payload, dict) or payload.get("status") != 200:
        message = payload.get("message") if isinstance(payload, dict) else payload
        raise ValueError(f"课程列表接口返回错误：{message}")
    data = payload.get("data")
    records = data.get("records") if isinstance(data, dict) else None
    if not isinstance(records, list):
        raise ValueError("课程列表响应中没有 records")
    for record in records:
        if not isinstance(record, dict) or not isinstance(record.get("id"), int):
            raise ValueError("课程列表包含无效的课程 ID")
    return records


def next_page_url(url, page_index):
    parsed = urlsplit(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["page.pageIndex"] = str(page_index)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))


def api_get_json(context, url, headers):
    response = context.request.get(url, headers=headers, timeout=30_000)
    if response.status == 401:
        raise PermissionError("登录已过期，请重新运行并在浏览器中登录")
    if not response.ok:
        raise RuntimeError(f"接口返回 HTTP {response.status}：{urlsplit(url).path}")
    try:
        return response.json()
    except ValueError as exc:
        raise ValueError(f"接口没有返回 JSON：{urlsplit(url).path}") from exc


def collect_records(context, first_response, headers):
    payload = first_response.json()
    records = records_from_response(payload)
    first_url = first_response.url
    page_size = int(dict(parse_qsl(urlsplit(first_url).query)).get("page.pageSize", "1000"))
    data = payload.get("data", {})
    total = data.get("rowCount", data.get("total"))
    if total is not None:
        total = int(total)
    page = 1
    while len(records) >= page * page_size and (total is None or len(records) < total):
        page += 1
        if page > 100:
            raise RuntimeError("课程列表超过 100 页，已停止以免无限循环")
        new_records = records_from_response(api_get_json(context, next_page_url(first_url, page), headers))
        if not new_records:
            break
        records.extend(new_records)
        if len(new_records) < page_size:
            break
    ids = [record["id"] for record in records]
    if len(ids) != len(set(ids)):
        raise ValueError("课程列表有重复课程 ID，无法安全编号")
    # The player requests courBeginTime in descending order. Name the files
    # chronologically, as the user's existing web2_1_1 ... web2_7_2 files do.
    return sorted(records, key=lambda record: (str(record.get("courBeginTime") or ""), record["id"]))


def wait_for_list(page, responses, seconds):
    for _ in range(seconds * 4):
        successful = [response for response in responses if response.ok]
        if successful:
            return successful[-1]
        if page.is_closed():
            raise RuntimeError("登录浏览器已关闭，请重新启动抓取任务")
        try:
            page.wait_for_timeout(250)
        except Exception as exc:
            if page.is_closed():
                raise RuntimeError("登录浏览器已关闭，请重新启动抓取任务") from exc
            raise
    return responses[-1] if responses else None


def capture_headers(response):
    source = response.request.all_headers()
    names = {"jwt-token", "authorization", "tenantid", "x-tenant-id"}
    headers = {key: value for key, value in source.items() if key.lower() in names}
    headers["Referer"] = RESOURCE_MANAGE_UI
    return headers


def subtitle_url(course_id):
    return f"https://{SITE_HOST}/jy-application-resourcemanage{SUBTITLE_ENDPOINT}{course_id}?useOriginal=false"


def existing_course_id(path):
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    items = payload.get("data", {}).get("afterAssemblyList", [])
    if not items:
        raise ValueError(f"已有文件没有字幕：{path}")
    return items[0].get("courseId")


def save_subtitle(path, payload, course_id):
    if not isinstance(payload, dict):
        raise ValueError("字幕接口响应不是 JSON 对象")
    subtitle_text(payload)
    if payload.get("status") != 200 or payload.get("ok") is False:
        raise ValueError(f"字幕接口返回错误：{payload.get('message')}")
    items = payload["data"]["afterAssemblyList"]
    if any(item.get("courseId") != course_id for item in items if isinstance(item, dict)):
        raise ValueError(f"字幕接口返回了其他课程的数据：{course_id}")
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(".json.tmp")
    try:
        temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def process_records(context, records, name, headers, on_progress=None, should_stop=None):
    INPUT_FOLDER.mkdir(exist_ok=True)
    OUTPUT_FOLDER.mkdir(exist_ok=True)
    for index, record in enumerate(records):
        stem = f"{name}_{index // 2 + 1}_{index % 2 + 1}"
        path = INPUT_FOLDER / f"{stem}.json"
        if path.exists() and existing_course_id(path) != record["id"]:
            raise ValueError(f"编号与已有文件冲突：{path.name} 对应的课程 ID 不同")

    failures = []
    downloaded = 0
    for index, record in enumerate(records):
        if should_stop and should_stop():
            raise RuntimeError("用户已停止抓取")
        course_id = record["id"]
        stem = f"{name}_{index // 2 + 1}_{index % 2 + 1}"
        json_path = INPUT_FOLDER / f"{stem}.json"
        txt_path = OUTPUT_FOLDER / f"{stem}_result.txt"
        try:
            fresh = not json_path.exists()
            if fresh:
                payload = api_get_json(context, subtitle_url(course_id), headers)
                save_subtitle(json_path, payload, course_id)
                downloaded += 1
            if fresh or not txt_path.exists():
                convert_file(json_path, OUTPUT_FOLDER)
            print(f"完成 {stem}（课程 ID {course_id}）")
            if on_progress:
                on_progress(index + 1, len(records), stem, None)
        except (OSError, RuntimeError, ValueError, PermissionError) as exc:
            failures.append((stem, str(exc)))
            print(f"失败 {stem}（课程 ID {course_id}）：{exc}", file=sys.stderr)
            if on_progress:
                on_progress(index + 1, len(records), stem, str(exc))
            if isinstance(exc, PermissionError):
                break
    return downloaded, failures


def run(url, name, profile, headless=False, on_status=None, on_progress=None,
        wait_for_login=False, login_confirmed=None, on_login_ready=None,
        should_stop=None):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("缺少 Playwright，请先运行：pip install -r requirements.txt") from exc

    with sync_playwright() as playwright:
        if on_status:
            on_status("正在打开浏览器")
        browser = playwright.chromium.launch_persistent_context(
            str(profile), channel="msedge", headless=headless, accept_downloads=False
        )
        try:
            login_page = browser.pages[0] if browser.pages else browser.new_page()
            login_page.goto(CANVAS_HOME, wait_until="domcontentloaded", timeout=45_000)
            if not headless:
                message = "请在第一个 Edge 标签登录 oc.sjtu.edu.cn，确认登录后再继续"
                if on_status:
                    on_status(message)
                if wait_for_login:
                    if on_login_ready:
                        on_login_ready()
                    if login_confirmed is None:
                        raise RuntimeError("界面缺少登录确认回调")
                    while not login_confirmed():
                        if should_stop and should_stop():
                            raise RuntimeError("用户已停止抓取")
                        if login_page.is_closed():
                            raise RuntimeError("Canvas 登录标签已关闭，请重新启动抓取任务")
                        login_page.wait_for_timeout(250)
                else:
                    print(message + "，然后回到终端按 Enter。")
                    try:
                        input()
                    except EOFError as exc:
                        raise RuntimeError("需要在交互式终端确认登录；已有登录状态时可使用 --headless") from exc

            if should_stop and should_stop():
                raise RuntimeError("用户已停止抓取")
            if on_status:
                on_status("正在第二个标签打开课程视频")
            page = browser.new_page()
            responses = []
            page.on("response", lambda response: responses.append(response) if LIST_ENDPOINT in response.url else None)
            page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            response = wait_for_list(page, responses, 45)
            if response is None:
                raise RuntimeError("视频页未发起课程列表请求。请确认第一个标签已登录、播放地址有效")
            if response.status == 401:
                raise PermissionError("课程列表请求返回 401，请重新登录")
            if on_status:
                on_status("正在读取课程目录")
            headers = capture_headers(response)
            records = collect_records(browser, response, headers)
            if not records:
                raise ValueError("这门课的点播列表为空")
            print(f"找到 {len(records)} 节视频；首节 ID：{records[0]['id']}，末节 ID：{records[-1]['id']}")
            if on_status:
                on_status(f"找到 {len(records)} 节视频，正在抓取字幕")
            downloaded, failures = process_records(browser, records, name, headers, on_progress, should_stop)
            print(f"完成：新增 {downloaded} 个 JSON，总计 {len(records)} 节，失败 {len(failures)} 节")
            if on_status:
                on_status(f"完成：新增 {downloaded} 份 JSON，失败 {len(failures)} 节")
            return 1 if failures else 0
        finally:
            browser.close()


def main():
    parser = argparse.ArgumentParser(description="从课程播放页抓取整门课的字幕并转换为 TXT")
    parser.add_argument("url", help="课程中任一节的 play-center 播放地址")
    parser.add_argument("--name", default="web2", help="输出文件名前缀，默认 web2")
    parser.add_argument("--profile", type=Path, default=DEFAULT_PROFILE, help="用于保存登录状态的浏览器目录")
    parser.add_argument("--headless", action="store_true", help="已有登录状态时后台运行")
    args = parser.parse_args()
    try:
        return run(validate_url(args.url), validate_name(args.name), args.profile, args.headless)
    except (OSError, RuntimeError, ValueError, PermissionError) as exc:
        print(f"错误：{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
