#!/usr/bin/env python3
"""Fact Lens 제출 PDF의 페이지와 텍스트 상태를 검증합니다."""
import json
from pathlib import Path
import re
import subprocess
import tempfile

PROJECT = Path(__file__).resolve().parents[2]
PDF_DIR = PROJECT.parent / "Fact_Lens_제출용_최종" / "필수" / "PDF"


def inspect(path: Path) -> dict:
    info = subprocess.run(
        ["pdfinfo", str(path)], capture_output=True, text=True, check=True,
    ).stdout
    pages_match = re.search(r"^Pages:\s+(\d+)", info, re.MULTILINE)
    size_match = re.search(r"^Page size:\s+(.+)$", info, re.MULTILINE)
    if not pages_match or not size_match:
        raise RuntimeError(f"PDF 정보를 읽지 못했습니다: {path}")

    with tempfile.NamedTemporaryFile(suffix=".txt") as extracted:
        subprocess.run(
            ["pdftotext", "-layout", str(path), extracted.name], check=True,
        )
        text = Path(extracted.name).read_text(encoding="utf-8")

    page_count = int(pages_match.group(1))
    texts = text.split("\f")[:page_count]
    source_page = next((index + 1 for index, page in enumerate(texts) if "붙임. 출처" in page), None)
    return {
        "pages": page_count,
        "replacement_chars": text.count("\ufffd"),
        "blank_pages": [index + 1 for index, page in enumerate(texts) if not page.strip()],
        "source_page": source_page,
        "body_pages": source_page - 1 if source_page else None,
        "a4_pages": "A4" in size_match.group(1),
    }


def main() -> None:
    reports = {path.name: inspect(path) for path in sorted(PDF_DIR.glob("*.pdf"))}
    print(json.dumps(reports, ensure_ascii=False, indent=2))

    summary = reports["서식1_Fact_Lens_작품요약서.pdf"]
    plan = reports["서식2_Fact_Lens_아이디어기획서.pdf"]
    if summary["pages"] != 1:
        raise SystemExit("서식 1이 1쪽이 아닙니다.")
    if plan["body_pages"] is None or plan["body_pages"] > 15:
        raise SystemExit("서식 2 본문이 15쪽 제한을 넘거나 출처 페이지를 찾지 못했습니다.")
    if any(report["replacement_chars"] or report["blank_pages"] or not report["a4_pages"] for report in reports.values()):
        raise SystemExit("PDF 텍스트 또는 페이지 상태 검사에 실패했습니다.")


if __name__ == "__main__":
    main()
