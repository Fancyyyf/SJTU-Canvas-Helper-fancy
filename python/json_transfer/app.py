"""Local browser UI for downloading and reading course subtitles."""

import argparse
import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from fetch_course import DEFAULT_PROFILE, run, validate_name, validate_url
from transfer import BASE_DIR, INPUT_FOLDER, OUTPUT_FOLDER

WEB_DIR = Path(__file__).resolve().parent / "web"
STEM_PATTERN = re.compile(r"[A-Za-z0-9_-]+")
NUMBERED_PATTERN = re.compile(r"^(?P<course>.+)_(?P<lesson>\d+)_(?P<part>[12])$")
DEFAULT_URL = (
    "https://v.sjtu.edu.cn/jy-application-resourcemanage-ui/#/play-center?"
    "mko2GSKtqO2hOGpVd4s4XKw3Rsz1w5dbiCdZF87zKhVEtXIfNfOAsZM6%2BTopgLG%2B"
)


def library():
    items = []
    for path in INPUT_FOLDER.glob("*.json"):
        match = NUMBERED_PATTERN.fullmatch(path.stem)
        if match:
            course = match.group("course")
            lesson = int(match.group("lesson"))
            part = int(match.group("part"))
        else:
            course, lesson, part = "其他课程", None, None
        items.append({
            "stem": path.stem,
            "course": course,
            "lesson": lesson,
            "part": part,
            "hasText": (OUTPUT_FOLDER / f"{path.stem}_result.txt").is_file(),
        })
    items.sort(key=lambda item: (item["course"] != "web2", item["course"],
                                 item["lesson"] if item["lesson"] is not None else 10**9,
                                 item["part"] if item["part"] is not None else 0,
                                 item["stem"]))
    return items


def lesson(stem):
    if not STEM_PATTERN.fullmatch(stem):
        raise ValueError("无效的课程文件名")
    path = INPUT_FOLDER / f"{stem}.json"
    if not path.is_file():
        raise FileNotFoundError("找不到这节课的字幕")
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    source = payload.get("data", {}).get("afterAssemblyList", [])
    if not isinstance(source, list):
        raise ValueError("字幕格式不正确")
    segments = [
        {"bg": item.get("bg"), "ed": item.get("ed"), "res": item.get("res", ""),
         "zh": item.get("zh", ""), "en": item.get("en", "")}
        for item in source if isinstance(item, dict)
    ]
    return {"stem": stem, "segments": segments,
            "courseId": segments and source[0].get("courseId"),
            "textAvailable": (OUTPUT_FOLDER / f"{stem}_result.txt").is_file()}


class Job:
    def __init__(self):
        self.lock = threading.Lock()
        self.cancel = threading.Event()
        self.login_confirmed = threading.Event()
        self.state = {"status": "idle", "message": "准备就绪", "done": 0, "total": 0,
                      "current": "", "failures": [], "name": "web2", "phase": "idle"}

    def snapshot(self):
        with self.lock:
            return dict(self.state, failures=list(self.state["failures"]))

    def update(self, **fields):
        with self.lock:
            self.state.update(fields)

    def start(self, url, name):
        with self.lock:
            if self.state["status"] == "running":
                raise RuntimeError("已有抓取任务正在运行")
            self.cancel.clear()
            self.login_confirmed.clear()
            self.state = {"status": "running", "message": "正在启动", "done": 0,
                          "total": 0, "current": "", "failures": [], "name": name,
                          "phase": "starting"}
        thread = threading.Thread(target=self._work, args=(url, name), daemon=True)
        thread.start()

    def confirm_login(self):
        with self.lock:
            if self.state["status"] != "running" or self.state["phase"] != "login":
                raise RuntimeError("当前没有等待确认的登录任务")
            self.state["phase"] = "video"
            self.state["message"] = "已确认 Canvas 登录，正在打开视频标签"
        self.login_confirmed.set()

    def _work(self, url, name):
        def status(message):
            self.update(message=message)

        def progress(done, total, stem, error):
            with self.lock:
                self.state.update(done=done, total=total, current=stem, phase="fetching")
                if error:
                    self.state["failures"].append({"stem": stem, "error": error})

        try:
            result = run(url, name, DEFAULT_PROFILE, on_status=status,
                         on_progress=progress, wait_for_login=True,
                         login_confirmed=self.login_confirmed.is_set,
                         on_login_ready=lambda: self.update(phase="login"),
                         should_stop=self.cancel.is_set)
            self.update(status="done" if result == 0 else "error", phase="finished")
        except Exception as exc:
            self.update(status="stopped" if self.cancel.is_set() else "error",
                        message=str(exc), phase="finished")


JOB = Job()


class Handler(BaseHTTPRequestHandler):
    def send_bytes(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, data):
        self.send_bytes(status, json.dumps(data, ensure_ascii=False).encode("utf-8"),
                        "application/json; charset=utf-8")

    def do_GET(self):
        parsed = urlsplit(self.path)
        try:
            if parsed.path == "/api/library":
                return self.send_json(200, {"items": library(), "defaultUrl": DEFAULT_URL})
            if parsed.path == "/api/job":
                return self.send_json(200, JOB.snapshot())
            if parsed.path == "/api/lesson":
                stem = parse_qs(parsed.query).get("stem", [""])[0]
                return self.send_json(200, lesson(stem))
            if parsed.path == "/api/download":
                stem = parse_qs(parsed.query).get("stem", [""])[0]
                if not STEM_PATTERN.fullmatch(stem):
                    raise ValueError("无效的课程文件名")
                path = OUTPUT_FOLDER / f"{stem}_result.txt"
                if not path.is_file():
                    raise FileNotFoundError("找不到 TXT 文件")
                body = path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Content-Disposition", f'attachment; filename="{path.name}"')
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                return self.wfile.write(body)
            file_name = {"/": "index.html", "/app.css": "app.css",
                         "/app.js": "app.js"}.get(parsed.path)
            if file_name:
                types = {"index.html": "text/html", "app.css": "text/css",
                         "app.js": "text/javascript"}
                return self.send_bytes(200, (WEB_DIR / file_name).read_bytes(),
                                       types[file_name] + "; charset=utf-8")
            self.send_json(404, {"error": "页面不存在"})
        except (ValueError, FileNotFoundError) as exc:
            self.send_json(404, {"error": str(exc)})

    def do_POST(self):
        origin = self.headers.get("Origin")
        if origin and origin != f"http://{self.headers.get('Host')}":
            return self.send_json(403, {"error": "无效的请求来源"})
        if self.path == "/api/stop":
            JOB.cancel.set()
            return self.send_json(200, JOB.snapshot())
        if self.path == "/api/confirm-login":
            try:
                JOB.confirm_login()
                return self.send_json(200, JOB.snapshot())
            except RuntimeError as exc:
                return self.send_json(409, {"error": str(exc)})
        if self.path != "/api/start":
            return self.send_json(404, {"error": "接口不存在"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 16_384:
                raise ValueError("请求长度不正确")
            data = json.loads(self.rfile.read(length))
            url = validate_url(data.get("url", ""))
            name = validate_name(data.get("name", "web2"))
            JOB.start(url, name)
            self.send_json(202, JOB.snapshot())
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})
        except RuntimeError as exc:
            self.send_json(409, {"error": str(exc)})


def main():
    parser = argparse.ArgumentParser(description="本地字幕阅读与抓取界面")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"字幕工作台：http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
