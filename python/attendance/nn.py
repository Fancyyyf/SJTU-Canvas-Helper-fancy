import argparse
import json
import os
import sys
import time
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import ImageGrab
from pyzbar.pyzbar import decode

from surveil import auto_sign

try:
    import winsound
except ImportError:
    winsound = None


ATTENDANCE_QR_PREFIX = "https://mlearning.sjtu.edu.cn/lms/mobile2/forscan/"
SUCCESS_DEDUP_SECONDS = 10 * 60
FAILURE_RETRY_SECONDS = 30


def emit(kind: str, message: str, qr_content: Optional[str] = None, **extra: object) -> None:
    payload = {
        "kind": kind,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "message": message,
        "qrContent": qr_content,
        **extra,
    }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def alert_sound() -> None:
    """保留原项目的签到提示音。"""
    try:
        if winsound is not None:
            winsound.Beep(1000, 1000)
        else:
            print("\a", end="", file=sys.stderr, flush=True)
    except Exception:
        pass


def scan_screen() -> List[str]:
    """抓取虚拟桌面并返回去重后的所有二维码内容。"""
    try:
        screen = ImageGrab.grab(all_screens=True)
    except TypeError:
        screen = ImageGrab.grab()
    frame = np.array(screen)
    contents: List[str] = []
    for obj in decode(frame):
        try:
            content = obj.data.decode("utf-8")
        except UnicodeDecodeError:
            continue
        if content not in contents:
            contents.append(content)
    return contents


def simple_watchdog(interval_ms: int = 1000, json_mode: bool = False) -> None:
    """按原项目方式持续扫描屏幕，并在发现签到二维码时调用 auto_sign。"""
    interval_ms = min(10000, max(500, int(interval_ms)))
    seen: Dict[str, Tuple[float, bool]] = {}

    if json_mode:
        emit("started", f"Python 签到守望已启动，每 {interval_ms} 毫秒扫描一次")
    else:
        print(">>> [忠诚的看门狗] 已启动！")
        print(">>> [任务] 每秒扫描全屏，发现二维码立即尝试签到。")
        print(">>> 按 Ctrl+C 可以停止工作。")

    while True:
        started = time.monotonic()
        try:
            codes = scan_screen()
            if json_mode:
                emit("scan", "完成一轮屏幕扫描")

            for content in codes:
                if not content.startswith(ATTENDANCE_QR_PREFIX):
                    continue

                previous = seen.get(content)
                if previous:
                    wait_seconds = SUCCESS_DEDUP_SECONDS if previous[1] else FAILURE_RETRY_SECONDS
                    if time.monotonic() - previous[0] < wait_seconds:
                        if json_mode:
                            emit("duplicate", "发现重复签到二维码，已按去重规则跳过", content)
                        continue

                if json_mode:
                    emit("detected", "发现课堂签到二维码，正在交给 Python 登录模块", content)
                    logger = lambda message: emit("info", message, content)
                else:
                    print(f"\n!!! [警报] 发现课堂签到二维码：{content}")
                    logger = print

                result = auto_sign(content, logger=logger)
                success = bool(result.get("success"))
                seen[content] = (time.monotonic(), success)
                if json_mode:
                    emit("success" if success else "failed", str(result.get("message", "")), content, result=result)
                else:
                    print(json.dumps(result, ensure_ascii=False, indent=2))
                alert_sound()

            now = time.monotonic()
            seen = {
                code: value
                for code, value in seen.items()
                if now - value[0] < SUCCESS_DEDUP_SECONDS
            }
        except KeyboardInterrupt:
            if json_mode:
                emit("stopped", "Python 签到守望已停止")
            else:
                print("\n>>> 遵命，停止监听。")
            break
        except Exception as error:
            if json_mode:
                emit("error", f"屏幕扫描异常：{error}")
            else:
                print(f"发生错误：{error}")

        elapsed = time.monotonic() - started
        time.sleep(max(0, interval_ms / 1000 - elapsed))


def _main() -> int:
    parser = argparse.ArgumentParser(description="SJTU 签到二维码屏幕守望")
    parser.add_argument("--watch", action="store_true", help="持续扫描屏幕")
    parser.add_argument("--scan-once", action="store_true", help="只扫描一次")
    parser.add_argument("--json", action="store_true", help="输出 JSON Lines 事件")
    parser.add_argument(
        "--interval-ms",
        type=int,
        default=int(os.getenv("SJTU_ATTENDANCE_INTERVAL_MS", "1000")),
    )
    args = parser.parse_args()

    if args.scan_once:
        codes = scan_screen()
        if args.json:
            emit("scan_result", f"识别到 {len(codes)} 个二维码", codes=codes)
        else:
            for code in codes:
                print(code)
        return 0

    simple_watchdog(args.interval_ms, args.json)
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
