/**
 * P-0660 임대관리 — 내용증명 PDF 생성 (noticePdf)
 * ================================================
 *
 * legalEngine 이 만든 '내용증명 문구'를 jsPDF 로 A4 한 장짜리 PDF로 그린다.
 *
 * ─ 규격: 우체국 e-그린우편(인터넷우체국 내용증명) 문서 작성 기준 ─
 *   · 용지: A4 세로 (210mm × 297mm)
 *   · 여백: 위 20mm · 아래 40mm · 왼쪽 15mm · 오른쪽 15mm
 *     (아래 40mm 는 우체국이 내용증명인·전자소인을 찍는 자리이므로 비워 둔다)
 *   · 폰트: 나눔고딕을 PDF 안에 심어(embed) 한글이 깨지지 않게 한다
 *
 * ─ 사용법 ─
 *   import { downloadNoticePdf } from '@/lib/noticePdf.js';
 *   await downloadNoticePdf({ tenantName:'홍길동', address:'서울시 ...', monthsArrears:3, accountNumber:'110-123-456789' });
 *
 *   // Node·테스트에서 폰트 파일을 직접 넣고 싶을 때
 *   await createNoticePdf(input, { fontBase64 });
 */

import { jsPDF } from 'jspdf';
import { buildNoticeContent } from './legalEngine.js';
import {
  registerKoreanFont,
  loadKoreanFontBase64,
  DEFAULT_KOREAN_FONT,
} from './koreanFont.js';

/** 우체국 e-그린우편(내용증명) 규격 상수 — 한 곳에서 관리한다. */
export const E_GREEN_SPEC = Object.freeze({
  pageSize: 'a4',
  orientation: 'portrait',
  width: 210,
  height: 297,
  margin: Object.freeze({ top: 20, right: 15, bottom: 40, left: 15 }),
  note: 'A4 세로 · 여백 위20/아래40/좌15/우15mm (인터넷우체국 내용증명 문서 작성 기준)',
});

const COLORS = Object.freeze({
  text: [17, 24, 39],
  muted: [107, 114, 128],
  rule: [156, 163, 175],
  ruleLight: [209, 213, 219],
});

const LINE_HEIGHT = 5.8;

/**
 * 한글은 띄어쓰기가 드물어 jsPDF 기본 줄바꿈이 실패할 수 있다.
 * 1차로 splitTextToSize(공백 기준)로 나누고,
 * 아직 폭을 넘는 줄은 글자 단위로 강제로 쪼갠다.
 */
export function wrapLines(doc, value, maxWidth) {
  const source = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!source) return [''];

  const rough = typeof doc.splitTextToSize === 'function'
    ? doc.splitTextToSize(source, maxWidth)
    : [source];

  const result = [];
  rough.forEach((line) => {
    if (doc.getTextWidth(line) <= maxWidth) {
      result.push(line);
      return;
    }
    let buffer = '';
    for (const char of line) {
      if (buffer && doc.getTextWidth(buffer + char) > maxWidth) {
        result.push(buffer);
        buffer = '';
      }
      buffer += char;
    }
    if (buffer) result.push(buffer);
  });

  return result.length ? result : [''];
}

/** 본문에 재사용할 '그리기 도구' 묶음을 만든다. */
function createWriter(doc, options = {}) {
  const { width, height, margin } = E_GREEN_SPEC;
  const left = margin.left;
  const right = width - margin.right;
  const contentWidth = right - left;
  const bottomLimit = height - margin.bottom;
  const fontFamily = options.font?.family || DEFAULT_KOREAN_FONT.family;

  let y = margin.top;

  const setStyle = (size, style, color) => {
    doc.setFont(fontFamily, style || 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const ensureSpace = (needed) => {
    if (y + needed <= bottomLimit) return;
    doc.addPage();
    y = margin.top;
  };

  /** 한 문단을 쓴다. 넘치면 자동으로 다음 페이지로. */
  const write = (value, opts = {}) => {
    const {
      size = 10.5,
      style = 'normal',
      align = 'left',
      color = COLORS.text,
      indent = 0,
      lineHeight = LINE_HEIGHT,
      gapAfter = 1.8,
      x = left,
    } = opts;

    setStyle(size, style, color);
    const maxWidth = contentWidth - indent;
    const lines = wrapLines(doc, value, maxWidth);

    lines.forEach((line) => {
      ensureSpace(lineHeight);
      const anchor = align === 'center' ? width / 2 : align === 'right' ? right : x + indent;
      const textOpts = { baseline: 'top' };
      if (align === 'center' || align === 'right') textOpts.align = align;
      doc.text(line, anchor, y, textOpts);
      y += lineHeight;
    });
    y += gapAfter;
    return lines.length;
  };

  const rule = (opts = {}) => {
    const { color = COLORS.ruleLight, gap = 2.4, thickness = 0.3 } = opts;
    ensureSpace(gap);
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(thickness);
    doc.line(left, y, right, y);
    y += gap;
  };

  const gap = (amount = 3) => {
    ensureSpace(amount);
    y += amount;
  };

  return {
    write,
    rule,
    gap,
    ensureSpace,
    get y() {
      return y;
    },
    set y(value) {
      y = value;
    },
    left,
    right,
    width,
    height,
    contentWidth,
    bottomLimit,
    fontFamily,
  };
}

/** 알맞은 크기의 빈 A4 문서를 만든다. */
export function createDocument() {
  return new jsPDF({
    unit: 'mm',
    format: E_GREEN_SPEC.pageSize,
    orientation: E_GREEN_SPEC.orientation,
    compress: false,
  });
}

/**
 * 완성된 내용증명 notice 구조를 PDF에 그린다.
 * @param {object} doc jsPDF 인스턴스
 * @param {object} notice buildNoticeContent() 결과
 * @param {object} [options]
 */
export function renderNotice(doc, notice, options = {}) {
  const w = createWriter(doc, options);

  // ── 머리글 ────────────────────────────────────────────────
  w.write(notice.title, { size: 20, align: 'center', color: COLORS.text, gapAfter: 1.2, lineHeight: 9 });
  w.write(notice.subtitle, { size: 10.5, align: 'center', color: COLORS.muted, gapAfter: 2.2 });
  w.rule({});
  w.write(`문서번호: ${notice.documentNumber}`, { size: 9, align: 'right', color: COLORS.muted, gapAfter: 0.8, lineHeight: 4.6 });
  w.write(`작성일: ${notice.issueDateText}`, { size: 9, align: 'right', color: COLORS.muted, gapAfter: 3 });
  w.rule({ color: COLORS.rule, gap: 2.8 });

  // ── 당사자 ────────────────────────────────────────────────
  w.write('수신 (임차인)', { size: 10, style: 'bold', color: COLORS.text, gapAfter: 1.2 });
  w.write(`성명: ${notice.tenant.name}`, { indent: 4, gapAfter: 0.6 });
  w.write(`주소: ${notice.tenant.address}`, { indent: 4, gapAfter: 2.6 });

  w.write('발신 (임대인)', { size: 10, style: 'bold', color: COLORS.text, gapAfter: 1.2 });
  w.write(`성명: ${notice.landlord.name}`, { indent: 4, gapAfter: 0.6 });
  if (notice.landlord.address) {
    w.write(`주소: ${notice.landlord.address}`, { indent: 4, gapAfter: 0.6 });
  }
  if (notice.landlord.phone) {
    w.write(`연락처: ${notice.landlord.phone}`, { indent: 4, gapAfter: 0.6 });
  }
  w.gap(2.2);
  w.rule({ color: COLORS.rule, gap: 3 });

  // ── 제목 ──────────────────────────────────────────────────
  w.write(`제목: ${notice.subtitle}`, { size: 12, style: 'bold', gapAfter: 3.2, lineHeight: 6.6 });

  // ── 본문 1: 사실관계 ──────────────────────────────────────
  notice.facts.forEach((line, index) => {
    w.write(`${index + 1}. ${line}`, { gapAfter: 2.2 });
  });

  // ── 본문 2: 법령 근거 ─────────────────────────────────────
  w.gap(0.6);
  w.write('【법령 근거】', { size: 10.5, style: 'bold', gapAfter: 1.6 });
  notice.legalBasis.forEach((line) => {
    const lines = wrapLines(doc, line, w.contentWidth - 6);
    lines.forEach((textLine, lineIndex) => {
      const prefix = lineIndex === 0 ? '· ' : '  ';
      w.write(`${prefix}${textLine}`, { indent: 4, size: 10, color: COLORS.text, gapAfter: lineIndex === lines.length - 1 ? 1.8 : 0.2, lineHeight: 5.4 });
    });
  });

  // ── 본문 3: 요구 사항 ─────────────────────────────────────
  w.gap(0.6);
  w.write(`【요구 사항】 ${notice.demandIntro}`, { size: 10.5, gapAfter: 1.8 });
  notice.demands.forEach((demand, index) => {
    w.write(`${index + 1}) ${demand}`, { indent: 4, size: 10, gapAfter: 1.0, lineHeight: 5.4 });
  });
  w.gap(1.2);

  // ── 본문 4: 불이행 시 조치 ────────────────────────────────
  w.write(notice.warning, { gapAfter: 2.4 });

  // ── 본문 5: 법적 절차 안내 (표 형태 텍스트) ───────────────
  w.write('【이행이 없을 경우의 법적 절차】', { size: 10.5, style: 'bold', gapAfter: 1.6 });
  notice.remedies.forEach((remedy) => {
    w.write(
      `${remedy.step}단계 · ${remedy.title} — ${remedy.detail}`,
      { indent: 4, size: 9.5, color: COLORS.text, gapAfter: 1.2, lineHeight: 5.0 },
    );
  });
  w.gap(1.6);

  // ── 맺음말 ────────────────────────────────────────────────
  w.write(notice.closing, { gapAfter: 4 });

  // ── 작성일자 · 서명란 ─────────────────────────────────────
  w.write(notice.issueDateText, { align: 'right', size: 10.5, gapAfter: 3 });
  w.write(`임대인  ${notice.landlord.name}  (인)`, { align: 'right', size: 10.5, style: 'bold', gapAfter: 4 });

  w.rule({ color: COLORS.ruleLight, gap: 2.6 });
  w.write(notice.disclaimer, { size: 8, color: COLORS.muted, lineHeight: 4.2, gapAfter: 0 });

  return doc;
}

/**
 * 입력값 → 내용증명 PDF(jsPDF 문서)를 만든다. (비동기: 폰트 로드 때문)
 * @param {object} input 폼 데이터 (legalEngine.buildNoticeContent 참고)
 * @param {object} [options] { fontBase64, fontUrl, font, notice, doc, fileName }
 * @returns {Promise<object>} jsPDF 인스턴스
 */
export async function createNoticePdf(input = {}, options = {}) {
  const notice = options.notice || buildNoticeContent(input, options);
  const doc = options.doc || createDocument();

  const base64 = options.fontBase64
    || await loadKoreanFontBase64(options.fontUrl || DEFAULT_KOREAN_FONT.url);

  registerKoreanFont(doc, base64, options.font);
  renderNotice(doc, notice, options);
  return doc;
}

/** 입력값으로 PDF 파일 이름을 만든다. 예) 내용증명_주택임대차_홍길동_20261012.pdf */
export function noticePdfFileName(input = {}, options = {}) {
  const notice = options.notice || buildNoticeContent(input, options);
  const date = notice.issueDate;
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const safeName = String(notice.tenant.name || '임차인').replace(/[\\/:*?"<>|]/g, '');
  return `내용증명_${notice.leaseLabel.replace(/\s+/g, '')}_${safeName}_${stamp}.pdf`;
}

/**
 * 브라우저에서 바로 내려받는다. (클라이언트 사이드 다운로드)
 * @returns {Promise<{doc:object, fileName:string}>}
 */
export async function downloadNoticePdf(input = {}, options = {}) {
  const doc = await createNoticePdf(input, options);
  const fileName = options.fileName || noticePdfFileName(input, options);
  doc.save(fileName);
  return { doc, fileName };
}

/** jsPDF 문서 → ArrayBuffer (서버 업로드·미리보기용) */
export function noticePdfArrayBuffer(doc) {
  return doc.output('arraybuffer');
}

/** jsPDF 문서 → Blob (미리보기·objectURL 용) */
export function noticePdfBlob(doc, type = 'application/pdf') {
  return new Blob([noticePdfArrayBuffer(doc)], { type });
}

/** jsPDF 문서 → data URI (새 창 미리보기용) */
export function noticePdfDataUri(doc) {
  return doc.output('datauristring');
}
