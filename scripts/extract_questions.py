#!/usr/bin/env python3
"""Convert pdftotext -layout output from the 2025 handbook into app data.

Usage: pdftotext -layout SQ_2025_Handbook.pdf /tmp/sq_handbook.txt
       python scripts/extract_questions.py /tmp/sq_handbook.txt data/questions.json questions.mjs
"""

import json
import re
import sys
from pathlib import Path

TOPICS = [
    "體力處理操作", "工場整理", "安全管理", "建造業安全", "個人防護",
    "消防安全", "飲食業安全", "電力安全", "辦公室安全", "燒焊操作安全",
    "機械操作安全", "職安健法例及資料", "職業安全約章", "職業健康",
    "化學品安全", "裝修維修工作安全", "國家及澳門特別行政區的職安健法例",
    "安全吊運", "職安局資訊", "其他",
]

QUESTION = re.compile(r"^\s*(\d{1,2}\.\d{1,3})\s+(.+)$", re.M)
OPTION = re.compile(r"^\s*([abc])[.．]\s+(.+)$", re.M)
ANSWER = re.compile(r"^\s*答案[：:]\s*([abc])\s*$", re.M)


def compact(value):
    value = re.sub(r"\s+", " ", value).strip()
    # Join Chinese line wraps while retaining spaces in terms such as "BS EN 362".
    return re.sub(r"(?<![A-Za-z0-9]) | (?![A-Za-z0-9])", "", value)


def extract(source):
    text = source.read_text(encoding="utf-8")
    matches = list(QUESTION.finditer(text))
    questions = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = text[match.end():end]
        options = list(OPTION.finditer(body))
        answers = list(ANSWER.finditer(body))
        if len(options) != 3 or [item.group(1) for item in options] != ["a", "b", "c"] or len(answers) != 1:
            raise ValueError(f"Unexpected question format: {match.group(1)}")
        number = match.group(1)
        topic = int(number.split(".")[0])
        if not 1 <= topic <= len(TOPICS):
            raise ValueError(f"Unexpected topic: {number}")
        prompt = compact(match.group(2) + body[:options[0].start()])
        choices = [compact(body[item.end():options[i + 1].start() if i < 2 else answers[0].start()])
                   for i, item in enumerate(options)]
        choices = [compact(item.group(2) + choice) for item, choice in zip(options, choices)]
        if not prompt or not all(choices):
            raise ValueError(f"Empty question or choice: {number}")
        questions.append({
            "id": number,
            "topic": topic,
            "page": text.count("\f", 0, match.start()) + 1,
            "question": prompt,
            "choices": choices,
            "answer": "abc".index(answers[0].group(1)),
        })
    if len(questions) != 1585 or len({q["id"] for q in questions}) != len(questions):
        raise ValueError(f"Expected 1585 unique questions; got {len(questions)}")
    return {"source": "職安健常識問答比賽手冊 2025", "topics": TOPICS, "questions": questions}


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Usage: extract_questions.py INPUT_TEXT OUTPUT_JSON OUTPUT_MODULE")
    result = extract(Path(sys.argv[1]))
    path = Path(sys.argv[2])
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
    path.write_text(serialized + "\n", encoding="utf-8")
    module_path = Path(sys.argv[3])
    module_path.write_text("// Generated from the 2025 handbook. See scripts/extract_questions.py.\nexport default " + serialized + ";\n", encoding="utf-8")
    print(f"Wrote {len(result['questions'])} questions to {path} and {module_path}")
