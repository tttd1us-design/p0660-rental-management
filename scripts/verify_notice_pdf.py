"""생성된 내용증명 PDF 를 제3자 도구(pymupdf)로 열어 규격을 검증한다.

검증 항목
1) 열리는가 / 쪽수
2) 한글이 '글자'로 추출되는가 (폰트가 심어졌는가)
3) 법령 조항 문구가 실제로 들어 있는가
4) 우체국 e-그린우편 규격(위20·아래257·좌15·우195mm)을 지키는가
5) 글자가 서로 겹치지 않는가

실행:  python scripts/verify_notice_pdf.py
"""
import re
import sys
from pathlib import Path

import fitz  # pymupdf

PT_PER_MM = 72.0 / 25.4
MARGIN = {"top": 20.0, "bottom": 257.0, "left": 15.0, "right": 195.0}

CASES = [
    {
        "path": ".probe/housing.pdf",
        "must_have": [
            "내 용 증 명",
            "수신 (임차인)",
            "발신 (임대인)",
            "문서번호",
            "「민법」 제640조",
            "「주택임대차보호법」 제6조의3 제1항 제1호",
            "홍길동",
            "법령 근거",
            "요구 사항",
            "이행이 없을 경우",
        ],
        "must_not_have": ["제10조의8"],
    },
    {
        "path": ".probe/commercial.pdf",
        "must_have": [
            "내 용 증 명",
            "「상가건물 임대차보호법」 제10조의8",
            "「상가건물 임대차보호법」 제10조 제1항 제1호",
            "상가건물 임대차",
        ],
        "must_not_have": ["제6조의3 제1항 제1호"],
    },
]

failures = []
report = []

for case in CASES:
    path = Path(case["path"])
    if not path.exists():
        failures.append(f"{path} 파일이 없습니다")
        continue

    doc = fitz.open(path)
    text = "\n".join(page.get_text() for page in doc)
    # 줄바꿈(wrap) 때문에 글자 사이에 공백이 끼므로, 공백을 모두 지우고 비교한다.
    flat = "".join(text.split())

    report.append(f"\n── {path.name} · {doc.page_count}쪽 · {path.stat().st_size:,}bytes")

    # 2) 한글 추출 여부
    hangul = sum(1 for ch in text if "\uac00" <= ch <= "\ud7a3")
    report.append(f"   한글 음절 추출: {hangul}자")
    if hangul < 200:
        failures.append(f"{path.name}: 한글이 {hangul}자만 추출됨 (폰트 미탑재 의심)")

    # 3) 문구 확인
    for phrase in case["must_have"]:
        if "".join(phrase.split()) not in flat:
            failures.append(f"{path.name}: 문구 누락 → {phrase}")
    for phrase in case["must_not_have"]:
        if "".join(phrase.split()) in flat:
            failures.append(f"{path.name}: 있으면 안 되는 문구 → {phrase}")

    # 4) 여백 규격 + 5) 겹침
    for page_no, page in enumerate(doc, start=1):
        width_mm = page.rect.width / PT_PER_MM
        height_mm = page.rect.height / PT_PER_MM
        spans = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    if span["text"].strip():
                        spans.append(span)
        if not spans:
            failures.append(f"{path.name} {page_no}쪽: 글자가 하나도 없습니다")
            continue

        top = min(s["bbox"][1] for s in spans) / PT_PER_MM
        bottom = max(s["bbox"][3] for s in spans) / PT_PER_MM
        left = min(s["bbox"][0] for s in spans) / PT_PER_MM
        right = max(s["bbox"][2] for s in spans) / PT_PER_MM
        report.append(
            f"   {page_no}쪽 {width_mm:.1f}×{height_mm:.1f}mm · "
            f"내용영역 위{top:.1f} 아래{bottom:.1f} 좌{left:.1f} 우{right:.1f}mm"
        )

        if abs(width_mm - 210) > 0.5 or abs(height_mm - 297) > 0.5:
            failures.append(f"{path.name} {page_no}쪽: A4 크기가 아님 ({width_mm:.1f}×{height_mm:.1f})")
        if top < MARGIN["top"] - 0.3:
            failures.append(f"{path.name} {page_no}쪽: 위 여백 침범 (top {top:.2f}mm)")
        if bottom > MARGIN["bottom"] + 0.3:
            failures.append(f"{path.name} {page_no}쪽: 아래 여백 침범 (bottom {bottom:.2f}mm)")
        if left < MARGIN["left"] - 0.3:
            failures.append(f"{path.name} {page_no}쪽: 좌 여백 침범 (left {left:.2f}mm)")
        if right > MARGIN["right"] + 0.3:
            failures.append(f"{path.name} {page_no}쪽: 우 여백 침범 (right {right:.2f}mm)")

        # 같은 줄 안에서 가로로 겹치는 글자 상자 찾기 (세로 위치가 겹치는 줄만 비교)
        boxes = sorted(((s["bbox"][0], s["bbox"][1], s["bbox"][2], s["bbox"][3]) for s in spans))
        overlaps = 0
        for i, a in enumerate(boxes):
            for b in boxes[i + 1:]:
                if b[0] > a[2]:
                    break
                vertical = min(a[3], b[3]) - max(a[1], b[1])
                if vertical > 2.0 and b[0] < a[2] - 1.0:
                    overlaps += 1
        if overlaps:
            failures.append(f"{path.name} {page_no}쪽: 글자 겹침 {overlaps}건")

    doc.close()

# ── 6) 글리프 누락 사전 차단: 내용증명을 만드는 코드에 폰트에 없는 글자가 없는지
#    (나눔고딕에 한자·일부 기호가 없어, 그 글자를 쓰면 PDF 에서 소리 없이 사라진다)
#    주석은 종이에 찍히지 않으므로 검사에서 뺀다.
FONT_TTF = Path('public/fonts/NanumGothic-Regular.ttf')
PDF_SOURCES = [Path('src/lib/legalEngine.js'), Path('src/lib/noticePdf.js')]


def code_only(source: str) -> str:
    """주석(// 와 /* */)을 지운 '실제 코드'만 남긴다."""
    source = re.sub(r'/\*[\s\S]*?\*/', ' ', source)
    source = re.sub(r'^\s*//.*$', ' ', source, flags=re.M)
    return source


if FONT_TTF.exists():
    from fontTools.ttLib import TTFont

    tt = TTFont(str(FONT_TTF))
    cmap = set()
    for table in tt['cmap'].tables:
        cmap |= set(table.cmap.keys())
    tt.close()

    report.append(f"\n── 폰트 글리프 검사 · {FONT_TTF.name} · 수록 글자 {len(cmap):,}자")
    for src in PDF_SOURCES:
        if not src.exists():
            failures.append(f"{src} 를 찾지 못했습니다")
            continue
        body = code_only(src.read_text(encoding='utf-8'))
        missing = sorted({
            ch for ch in body
            if ord(ch) > 0x7F and not ch.isspace() and ord(ch) not in cmap
        })
        report.append(f"   {src.name}: 폰트에 없는 글자 {len(missing)}자")
        if missing:
            failures.append(
                f"{src.name}: 폰트에 없어 PDF 에서 사라지는 글자 → {' '.join(missing)}"
            )
else:
    failures.append(f"{FONT_TTF} 를 찾지 못했습니다")

print("\n".join(report))

if failures:
    print("\n❌ 검증 실패")
    for item in failures:
        print("  -", item)
    sys.exit(1)

print("\n✅ 검증 통과 — 한글 렌더링·법령 문구·e-그린우편 여백 규격·겹침 없음 모두 확인")
