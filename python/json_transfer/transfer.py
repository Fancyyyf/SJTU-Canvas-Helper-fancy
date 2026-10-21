"""Convert saved SJTU subtitle JSON files to plain text."""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2] / "public" / "subtitle_archive"
INPUT_FOLDER = BASE_DIR / "json_data"
OUTPUT_FOLDER = BASE_DIR / "results"


def subtitle_text(payload):
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ValueError("JSON 缺少 data 对象")
    items = data.get("afterAssemblyList")
    if not isinstance(items, list) or not items:
        raise ValueError("JSON 缺少非空的 afterAssemblyList")
    content = "".join(item.get("res", "") for item in items if isinstance(item, dict))
    if not content.strip():
        raise ValueError("字幕内容为空")
    return content


def convert_file(json_file, output_dir=OUTPUT_FOLDER):
    json_file = Path(json_file)
    output_dir = Path(output_dir)
    with json_file.open("r", encoding="utf-8") as handle:
        content = subtitle_text(json.load(handle))
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{json_file.stem}_result.txt"
    output_path.write_text(content, encoding="utf-8")
    return output_path


def batch_process_json(input_folder_name=INPUT_FOLDER, output_folder_name=OUTPUT_FOLDER):
    input_dir = Path(input_folder_name)
    if not input_dir.is_dir():
        raise FileNotFoundError(f"找不到输入文件夹：{input_dir}")
    files = sorted(input_dir.glob("*.json"))
    if not files:
        print(f"在 {input_dir} 中没有找到 JSON 文件")
    for json_file in files:
        try:
            output_path = convert_file(json_file, output_folder_name)
            print(f"已处理：{json_file.name} -> {output_path.name}")
        except (OSError, ValueError, TypeError) as exc:
            print(f"处理 {json_file.name} 时出错：{exc}")


if __name__ == "__main__":
    batch_process_json()
