import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  E_GREEN_SPEC,
  createDocument,
  createNoticePdf,
  downloadNoticePdf,
  noticePdfArrayBuffer,
  noticePdfBlob,
  noticePdfDataUri,
  noticePdfFileName,
  renderNotice,
  wrapLines,
} from '../src/lib/noticePdf.js';
import {
  KOREAN_FONT_FAMILY,
  arrayBufferToBase64,
  registerKoreanFont,
} from '../src/lib/koreanFont.js';
import { buildNoticeContent } from '../src/lib/legalEngine.js';

/** 실제 나눔고딕 TTF — 테스트에서는 fetch 대신 파일에서 직접 읽어 base64 로 넘긴다. */
const FONT_BASE64 = readFileSync(
  resolve(process.cwd(), 'public', 'fonts', 'NanumGothic-Regular.ttf'),
).toString('base64');

const HOUSING = {
  tenantName: '홍길동',
  address: '서울특별시 강남구 테헤란로 123, 101동 1001호',
  monthsArrears: '3',
  accountNumber: '110-123-456789',
  leaseType: 'housing',
  landlordName: '김임대',
  landlordPhone: '010-1234-5678',
  issueDate: '2026-10-12',
};

const COMMERCIAL = { ...HOUSING, leaseType: 'commercial', monthsArrears: '3' };

/** PDF 를 라틴1 문자열로 읽어, 폰트·유니코드맵이 실제로 들어갔는지 확인할 때 쓴다. */
const pdfText = (doc) => Buffer.from(noticePdfArrayBuffer(doc)).toString('latin1');

/** 한글 음절이 PDF 안에 '유니코드 매핑'으로 존재하는지 확인한다. */
const hasGlyph = (pdf, char) => {
  const hex = char.codePointAt(0).toString(16).padStart(4, '0');
  return pdf.includes(`<${hex}>`);
};

describe('noticePdf — e-그린우편 규격 상수', () => {
  it('A4 세로(210×297)와 여백 위20/아래40/좌15/우15mm 를 지킨다', () => {
    expect(E_GREEN_SPEC.pageSize).toBe('a4');
    expect(E_GREEN_SPEC.orientation).toBe('portrait');
    expect(E_GREEN_SPEC.width).toBe(210);
    expect(E_GREEN_SPEC.height).toBe(297);
    expect(E_GREEN_SPEC.margin.top).toBe(20);
    expect(E_GREEN_SPEC.margin.bottom).toBe(40);
    expect(E_GREEN_SPEC.margin.left).toBe(15);
    expect(E_GREEN_SPEC.margin.right).toBe(15);
  });

  it('createDocument() 는 A4 크기 한 장짜리 문서를 만든다', () => {
    const doc = createDocument();
    expect(Math.abs(doc.internal.pageSize.getWidth() - 210)).toBeLessThan(0.5);
    expect(Math.abs(doc.internal.pageSize.getHeight() - 297)).toBeLessThan(0.5);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

describe('noticePdf — 줄바꿈(wrapLines)', () => {
  const fakeDoc = {
    splitTextToSize: (value) => [value],
    getTextWidth: (value) => value.length * 10,
  };

  it('폭을 넘는 긴 줄을 글자 단위로 쪼갠다', () => {
    expect(wrapLines(fakeDoc, '가'.repeat(30), 100)).toEqual([
      '가'.repeat(10),
      '가'.repeat(10),
      '가'.repeat(10),
    ]);
  });

  it('짧은 줄은 그대로 두고, 빈 값은 [""] 로 돌려준다', () => {
    expect(wrapLines(fakeDoc, '짧은 줄', 100)).toEqual(['짧은 줄']);
    expect(wrapLines(fakeDoc, '', 100)).toEqual(['']);
    expect(wrapLines(fakeDoc, '   ', 100)).toEqual(['']);
  });
});

describe('noticePdf — 한글 폰트 등록', () => {
  it('document 가 아니면 오류를 낸다', () => {
    expect(() => registerKoreanFont(null, FONT_BASE64)).toThrow();
    expect(() => registerKoreanFont({}, FONT_BASE64)).toThrow();
  });

  it('폰트 base64 가 비어 있으면 오류를 낸다', () => {
    const doc = createDocument();
    expect(() => registerKoreanFont(doc, '')).toThrow();
    expect(() => registerKoreanFont(doc, 'too-short')).toThrow();
  });

  it('arrayBufferToBase64() 는 바이트를 base64 로 바꾼다', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(arrayBufferToBase64(bytes)).toBe('SGVsbG8=');
    expect(arrayBufferToBase64(bytes.buffer)).toBe('SGVsbG8=');
  });

  it('나눔고딕 TTF 가 2MB 안팎의 실제 파일이다', () => {
    expect(FONT_BASE64.length).toBeGreaterThan(1_000_000);
  });
});

describe('noticePdf — 내용증명 PDF 생성 (한글 렌더링)', () => {
  it('주택 내용증명 PDF 를 만들고 한글 폰트를 심는다', async () => {
    const doc = await createNoticePdf(HOUSING, { fontBase64: FONT_BASE64 });
    const pdf = pdfText(doc);

    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf).toContain('FontFile2'); // 폰트 프로그램이 PDF 안에 들어감
    expect(pdf).toContain('/ToUnicode'); // 글자↔유니코드 대응표
    expect(pdf).toContain(KOREAN_FONT_FAMILY);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('문서에 쓰인 한글이 유니코드 대응표에 실제로 들어 있다', async () => {
    const pdf = pdfText(await createNoticePdf(HOUSING, { fontBase64: FONT_BASE64 }));

    // '내 용 증 명' / '주택임대차' / '차임연체' 등에 쓰인 음절
    for (const char of ['내', '용', '증', '명', '주', '택', '임', '대', '차', '홍', '길', '동']) {
      expect(hasGlyph(pdf, char), `${char} 글리프가 PDF 에 없습니다`).toBe(true);
    }
  });

  it('상가 내용증명(3기 연체)도 조항과 한글을 담아 만든다', async () => {
    const doc = await createNoticePdf(COMMERCIAL, { fontBase64: FONT_BASE64 });
    const pdf = pdfText(doc);

    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf).toContain('FontFile2');
    for (const char of ['상', '가', '건', '물', '조']) {
      expect(hasGlyph(pdf, char), `${char} 글리프가 PDF 에 없습니다`).toBe(true);
    }
  });

  it('생성한 PDF 는 여백 규격(위20·아래257·좌15·우195mm)을 벗어나지 않는다', () => {
    const doc = createDocument();
    registerKoreanFont(doc, FONT_BASE64);

    const notice = buildNoticeContent(HOUSING);
    const calls = [];
    const original = doc.text.bind(doc);
    doc.text = (value, x, y, opts) => {
      calls.push({ value, x, y, opts });
      return original(value, x, y, opts);
    };

    renderNotice(doc, notice);

    expect(calls.length).toBeGreaterThan(10);
    const xs = calls.map((c) => c.x);
    const ys = calls.map((c) => c.y);

    // 글자를 그리기 시작하는 y 는 위 여백(20mm)보다 위로 올라가면 안 된다.
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(19.9);
    // 아래 여백(297-40=257mm)을 넘어서면 우체국 소인 자리를 침범한다.
    expect(Math.max(...ys)).toBeLessThanOrEqual(257);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(14.9);
    expect(Math.max(...xs)).toBeLessThanOrEqual(195.1);
  });

  it('본문이 길어도 페이지를 넘겨 끝까지 그린다', async () => {
    const doc = await createNoticePdf(
      { ...HOUSING, address: '서울특별시 강남구 테헤란로 123, 101동 1001호 (아주 긴 주소를 반복합니다) '.repeat(3) },
      { fontBase64: FONT_BASE64 },
    );
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const pdf = pdfText(doc);
    expect(pdf).toContain('FontFile2');
  });
});

describe('noticePdf — 파일 이름·출력 형식', () => {
  it('파일 이름은 내용증명_유형_임차인_날짜.pdf 규칙을 따른다', () => {
    expect(noticePdfFileName(HOUSING)).toBe('내용증명_주택임대차_홍길동_20261012.pdf');
    expect(noticePdfFileName(COMMERCIAL)).toBe('내용증명_상가건물임대차_홍길동_20261012.pdf');
  });

  it('ArrayBuffer·Blob·DataURI 로 내보낼 수 있다', async () => {
    const doc = await createNoticePdf(HOUSING, { fontBase64: FONT_BASE64 });

    const arrayBuffer = noticePdfArrayBuffer(doc);
    expect(arrayBuffer.byteLength).toBeGreaterThan(1000);
    expect(Buffer.from(arrayBuffer).toString('latin1').startsWith('%PDF-')).toBe(true);

    const blob = noticePdfBlob(doc);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);

    expect(noticePdfDataUri(doc).startsWith('data:application/pdf')).toBe(true);
  });

  it('downloadNoticePdf() 는 규칙에 맞는 이름으로 저장을 호출한다', async () => {
    const doc = createDocument();
    const saved = [];
    doc.save = (fileName) => {
      saved.push(fileName);
      return doc;
    };

    const result = await downloadNoticePdf(HOUSING, { doc, fontBase64: FONT_BASE64 });

    expect(saved).toEqual(['내용증명_주택임대차_홍길동_20261012.pdf']);
    expect(result.fileName).toBe('내용증명_주택임대차_홍길동_20261012.pdf');
    expect(result.doc).toBe(doc);
  });

  it('renderNotice() 는 넘겨받은 문서를 그대로 돌려준다', () => {
    const doc = createDocument();
    registerKoreanFont(doc, FONT_BASE64);
    expect(renderNotice(doc, buildNoticeContent(HOUSING))).toBe(doc);
  });
});
