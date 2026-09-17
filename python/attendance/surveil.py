import argparse
import json
import os
import re
import time
import urllib.parse
from typing import Callable, Dict, Optional, Tuple
from urllib.parse import parse_qs, urlparse

import ddddocr
import requests
from bs4 import BeautifulSoup

# 保留原项目的配置入口；桌面应用运行时会优先通过环境变量传入配置。
USERNAME = ""
PASSWORD = ""
url = "https://mlearning.sjtu.edu.cn/lms/mobile2/forscan/?..."

QR_HOST = "mlearning.sjtu.edu.cn"
QR_PATH = "/lms/mobile2/forscan/"
JACCOUNT_ORIGIN = "https://jaccount.sjtu.edu.cn"
LOGIN_API_URL = f"{JACCOUNT_ORIGIN}/jaccount/ulogin"
MLEARNING_ORIGIN = "https://mlearning.sjtu.edu.cn"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def _noop_log(_: str) -> None:
    pass


def _new_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = False
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Connection": "keep-alive",
        }
    )
    return session


def _validate_target(target_qr_url: str) -> Tuple[str, str]:
    parsed = urlparse(target_qr_url.strip())
    if parsed.scheme != "https" or parsed.hostname != QR_HOST or not parsed.path.startswith(QR_PATH):
        raise ValueError("仅支持 mlearning.sjtu.edu.cn 的课堂扫码签到链接")
    params = parse_qs(parsed.query)
    roll_call_token = params.get("rollCallToken", [""])[0]
    sign_history_id = params.get("signHistoryId", [""])[0]
    if not roll_call_token or not sign_history_id:
        raise ValueError("签到链接缺少 rollCallToken 或 signHistoryId 参数")
    return roll_call_token, sign_history_id


def _token_from_session(session: requests.Session) -> str:
    for cookie in session.cookies:
        if cookie.name == "token":
            return urllib.parse.unquote(cookie.value).strip('"')
    return ""


def _response_success(response: requests.Response) -> Tuple[bool, str]:
    try:
        body = response.json()
    except json.JSONDecodeError:
        body = {}
    message = str(
        body.get("resultMessage")
        or body.get("message")
        or body.get("error")
        or f"签到服务返回 HTTP {response.status_code}"
    )
    result_code = str(body.get("resultCode", body.get("code", ""))).upper()
    body_status = str((body.get("body") or {}).get("status", "")).upper()
    success = response.ok and (
        result_code in {"200", "SUCCESS"}
        or body_status in {"NORMAL", "SUCCESS", "SIGNED"}
        or "操作成功" in message
        or "签到成功" in message
    )
    return success, message


def _submit_sign(
    session: requests.Session,
    target_qr_url: str,
    roll_call_token: str,
    sign_history_id: str,
    jwt_token: str,
    log: Callable[[str], None],
) -> Dict[str, object]:
    sign_url = (
        f"{MLEARNING_ORIGIN}/lms-lti-rollcall-sjtu/sign/scan/"
        f"{urllib.parse.quote(roll_call_token, safe='')}/"
        f"{urllib.parse.quote(sign_history_id, safe='')}"
    )
    log("🎯 正在调用课堂签到接口...")
    response = session.get(
        sign_url,
        headers={
            "Authorization": jwt_token,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Referer": "https://mlearning.sjtu.edu.cn/lms/mobile/",
            "User-Agent": USER_AGENT,
        },
        timeout=30,
    )
    success, message = _response_success(response)
    return {
        "success": success,
        "message": message,
        "qrUrl": target_qr_url,
        "responseStatus": response.status_code,
        "responseBody": response.text[:2000],
    }


def _session_from_cookie(target_qr_url: str, ja_auth_cookie: str) -> Tuple[requests.Session, str]:
    session = _new_session()
    session.cookies.set(
        "JAAuthCookie",
        ja_auth_cookie,
        domain="jaccount.sjtu.edu.cn",
        path="/",
    )
    response = session.get(target_qr_url, timeout=30)
    response.raise_for_status()
    return session, _token_from_session(session)


def _session_from_password(
    target_qr_url: str,
    username: str,
    password: str,
    risk_delay_ms: int,
    log: Callable[[str], None],
) -> Tuple[requests.Session, str]:
    ocr = ddddocr.DdddOcr(show_ad=False)
    last_error = ""

    for attempt in range(1, 4):
        session = _new_session()
        try:
            log(f"🌐 [1/4] 访问签到链接并获取登录页（第 {attempt}/3 次）...")
            login_page_resp = session.get(target_qr_url, timeout=30)
            login_page_resp.raise_for_status()
            parsed_url = urlparse(login_page_resp.url)
            params = parse_qs(parsed_url.query)
            soup = BeautifulSoup(login_page_resp.text, "html.parser")

            uuid_match = re.search(r"uuid=([a-zA-Z0-9\-]+)", login_page_resp.text)
            uuid_tag = soup.find("input", {"name": "uuid"})
            uuid = (
                uuid_tag.get("value", "")
                if uuid_tag
                else uuid_match.group(1) if uuid_match else ""
            )
            if not uuid:
                raise RuntimeError("登录页中没有验证码 UUID，页面结构可能已变化")

            lt_tag = soup.find("input", {"name": "lt"})
            v_tag = soup.find("input", {"name": "v"})
            lt = lt_tag.get("value", "p") if lt_tag else "p"
            v = v_tag.get("value", "") if v_tag else ""

            log(f"🔍 [2/4] 获取并识别验证码（UUID: {uuid[:8]}...）...")
            captcha_resp = session.get(
                f"{JACCOUNT_ORIGIN}/jaccount/captcha?uuid={uuid}",
                headers={"Referer": login_page_resp.url},
                timeout=30,
            )
            captcha_resp.raise_for_status()
            captcha = "".join(
                character
                for character in ocr.classification(captcha_resp.content).strip().lower()
                if character.isalnum()
            )
            if not captcha:
                raise RuntimeError("验证码模型未识别出有效字符")

            delay_ms = min(5000, max(500, int(risk_delay_ms)))
            log(f"⏳ 验证码已在本机识别，等待 {delay_ms} 毫秒后提交...")
            time.sleep(delay_ms / 1000)
            payload = {
                "sid": params.get("sid", [""])[0],
                "client": params.get("client", [""])[0],
                "returl": params.get("returl", [""])[0],
                "se": params.get("se", [""])[0],
                "v": v,
                "uuid": uuid,
                "user": username,
                "pass": password,
                "captcha": captcha,
                "lt": lt,
            }
            log("🔥 [3/4] 向 jAccount 提交登录请求...")
            response = session.post(
                LOGIN_API_URL,
                data=payload,
                headers={
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": JACCOUNT_ORIGIN,
                },
                timeout=30,
            )
            response.raise_for_status()
            result_json = response.json()
            login_ok = result_json.get("errno") == 0 or result_json.get("code") == "SUCCESS"
            if not login_ok:
                reason = str(
                    result_json.get("error")
                    or result_json.get("message")
                    or result_json.get("code")
                    or "未知原因"
                )
                last_error = reason
                if reason == "Wrong captcha" or result_json.get("code") == "WRONG_CAPTCHA":
                    log("验证码未通过，正在重新获取并识别...")
                    continue
                raise RuntimeError(f"jAccount 拒绝登录：{reason}")

            redirect_url = result_json.get("url")
            if redirect_url:
                if not redirect_url.startswith("http"):
                    redirect_url = JACCOUNT_ORIGIN + redirect_url
                session.get(redirect_url, timeout=30).raise_for_status()

            jwt_token = _token_from_session(session)
            if not jwt_token:
                raise RuntimeError("登录成功但没有取得 mLearning token")
            log("✅ [4/4] jAccount 登录成功并已取得 mLearning 会话。")
            return session, jwt_token
        except (requests.RequestException, json.JSONDecodeError, RuntimeError) as error:
            last_error = str(error)
            if attempt == 3 or "jAccount 拒绝登录" in last_error:
                break
            log(f"本次自动登录失败：{last_error}；准备重试。")

    raise RuntimeError(f"自动登录失败：{last_error or '连续三次未通过验证码'}")


def auto_sign(
    TARGET_QR_URL: str,
    username: Optional[str] = None,
    password: Optional[str] = None,
    risk_delay_ms: Optional[int] = None,
    ja_auth_cookie: Optional[str] = None,
    logger: Optional[Callable[[str], None]] = print,
) -> Dict[str, object]:
    """使用原项目的 jAccount 流程提交一次签到并返回结构化结果。"""
    log = logger or _noop_log
    username = username if username is not None else os.getenv("SJTU_ATTENDANCE_USERNAME", USERNAME)
    password = password if password is not None else os.getenv("SJTU_ATTENDANCE_PASSWORD", PASSWORD)
    ja_auth_cookie = (
        ja_auth_cookie
        if ja_auth_cookie is not None
        else os.getenv("SJTU_ATTENDANCE_JA_AUTH_COOKIE", "")
    )
    try:
        risk_delay_ms = int(
            risk_delay_ms
            if risk_delay_ms is not None
            else os.getenv("SJTU_ATTENDANCE_RISK_DELAY_MS", "1000")
        )
    except (TypeError, ValueError):
        risk_delay_ms = 1000

    try:
        roll_call_token, sign_history_id = _validate_target(TARGET_QR_URL)
        session: Optional[requests.Session] = None
        jwt_token = ""

        if ja_auth_cookie.strip():
            log("正在优先复用已有 jAccount 扫码登录态...")
            try:
                session, jwt_token = _session_from_cookie(TARGET_QR_URL, ja_auth_cookie.strip())
            except requests.RequestException as error:
                log(f"扫码登录态不可用：{error}")

        if not jwt_token:
            if not username.strip() or not password:
                raise RuntimeError("没有可用登录方式：请完成扫码登录或配置学号密码")
            session, jwt_token = _session_from_password(
                TARGET_QR_URL,
                username.strip(),
                password,
                risk_delay_ms,
                log,
            )

        return _submit_sign(
            session,
            TARGET_QR_URL,
            roll_call_token,
            sign_history_id,
            jwt_token,
            log,
        )
    except Exception as error:
        return {
            "success": False,
            "message": str(error),
            "qrUrl": TARGET_QR_URL,
            "responseStatus": 0,
            "responseBody": "",
        }


def _main() -> int:
    parser = argparse.ArgumentParser(description="SJTU 课堂签到 Python 模块")
    parser.add_argument(
        "--url",
        default=os.getenv("SJTU_ATTENDANCE_URL", url),
        help="完整的 mLearning 签到二维码链接（也可使用 SJTU_ATTENDANCE_URL）",
    )
    parser.add_argument("--json", action="store_true", help="仅在 stdout 输出最终 JSON 结果")
    args = parser.parse_args()
    result = auto_sign(args.url, logger=None if args.json else print)
    if args.json:
        print(json.dumps({"kind": "result", **result}, ensure_ascii=False), flush=True)
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if bool(result.get("success")) else 1


if __name__ == "__main__":
    raise SystemExit(_main())
