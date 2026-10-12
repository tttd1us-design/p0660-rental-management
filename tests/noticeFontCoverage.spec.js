/**
 * 한글 폰트 커버리지 검사.
 *
 * 나눔고딕(NanumGothic)에는 한자·일부 기호 글리프가 없다.
 * 폰트에 없는 글자를 쓰면 PDF 에서 그 글자만 '조용히' 사라진다(오류도 나지 않는다).
 * 그래서 ① 생성된 PDF 의 유니코드 대응표(ToUnicode CMap)를 읽어,
 *          ② 실제로 쓰는 모든 글자가 폰트 안에 들어 있는지 대조한다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildNoticeContent, generateLegalNoticeText } from '../src/lib/legalEngine.js';
import { createNoticePdf, noticePdfArrayBuffer } from '../src/lib/noticePdf.js';

const FONT_BASE64 = readFileSync(
  resolve(process.cwd(), 'public', 'fonts', 'NanumGothic-Regular.ttf'),
).toString('base64');

const SAMPLES = [
  {
    tenantName: '홍길동',
    address: '경기도 안양시 동안구 평촌대로 214',
    monthsArrears: 5,
    accountNumber: '123-456-7890123',
    leaseType: 'housing',
    landlordName: '김임대',
    issueDate: '2026-10-12',
  },
  {
    tenantName: '박상가',
    address: '부산광역시 해운대구 센텀중앙로 90',
    monthsArrears: 3,
    accountNumber: '111-222-333333',
    leaseType: 'commercial',
    landlordName: '이건물',
    issueDate: '2026-10-12',
  },
  {
    tenantName: '최미달',
    address: '대구광역시 수성구 달구벌대로 1',
    monthsArrears: 1,
    accountNumber: '555-666-777888',
    leaseType: 'commercial',
    issueDate: '2026-10-12',
  },
];

/** PDF 안의 ToUnicode CMap 을 읽어 '폰트가 실제로 담고 있는 글자 코드' 집합을 만든다. */
function fontCodePoints(pdfBytes) {
  const raw = Buffer.from(pdfBytes).toString('latin1');
  const codes = new Set();

  // 연속 구간 매핑: beginbfrange ... <시작> <끝> <코드시작> ... endbfrange
  for (const block of raw.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const count = parseInt(m[2], 16) - parseInt(m[1], 16);
      const start = parseInt(m[3], 16);
      for (let i = 0; i <= count; i += 1) {
        codes.add(start + i);
      }
    }
  }

  // 낱개 매핑: beginbfchar ... <글리프> <코드> ... endbfchar
  for (const block of raw.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      codes.add(parseInt(m[2], 16));
    }
  }

  return codes;
}

/** PDF 가 실제로 그리는 문구만 모은다 (noticePdf.js 의 renderNotice 가 쓰는 항목과 일치). */
function renderedText(notice) {
  const parts = [
    notice.title,
    notice.subtitle,
    notice.documentNumber,
    notice.issueDateText,
    notice.tenant?.name,
    notice.tenant?.address,
    notice.landlord?.name,
    notice.landlord?.address,
    notice.landlord?.phone,
    notice.demandIntro,
    notice.warning,
    notice.closing,
    notice.disclaimer,
    ...(notice.facts || []),
    ...(notice.legalBasis || []),
    ...(notice.demands || []),
  ];
  for (const remedy of notice.remedies || []) {
    if (typeof remedy === 'string') {
      parts.push(remedy);
    } else {
      parts.push(remedy.step, remedy.title, remedy.detail);
    }
  }
  return parts.filter((value) => typeof value === 'string').join('');
}

describe('내용증명 글자 — 한글 폰트 커버리지', () => {
  it('한자(중국어) 문자를 쓰지 않는다', () => {
    for (const input of SAMPLES) {
      const text = generateLegalNoticeText(input);
      const found = [...new Set([...text].filter((ch) => /[\u3400-\u9fff\uf900-\ufaff]/.test(ch)))];
      expect(found, `한자 발견 → ${found.join(' ')}`).toEqual([]);
    }
  });

  it('폰트에 없는 글자를 쓰지 않는다 (PDF 유니코드 대응표와 전수 대조)', async () => {
    for (const input of SAMPLES) {
      const notice = buildNoticeContent(input);
      const doc = await createNoticePdf(input, { fontBase64: FONT_BASE64 });
      const covered = fontCodePoints(noticePdfArrayBuffer(doc));

      // 파싱이 제대로 됐는지 확인하는 최소선 (실제 문서 한 글자 수는 190자 안팎)
      expect(covered.size).toBeGreaterThan(100);

      const wanted = new Set([...renderedText(notice)].filter((ch) => !/\s/.test(ch)));
      const missing = [...wanted].filter((ch) => !covered.has(ch.codePointAt(0)));

      expect(
        missing,
        `[${input.tenantName}] 나눔고딕에 없어 PDF 에서 사라지는 글자 → ${missing.join(' ')}`,
      ).toEqual([]);
    }
  });

  it('내용증명 본문이 실제로 렌더링된다 (글자 수와 어두운 픽셀)', async () => {
    const doc = await createNoticePdf(SAMPLES[0], { fontBase64: FONT_BASE64 });
    const bytes = noticePdfArrayBuffer(doc);

    expect(Buffer.from(bytes).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(Buffer.from(bytes).includes('FontFile2')).toBe(true);
    expect(Buffer.from(bytes).includes('ToUnicode')).toBe(true);
  });

  it('법령 조항 표기(「 」)가 폰트에 들어 있다', async () => {
    const doc = await createNoticePdf(SAMPLES[1], { fontBase64: FONT_BASE64 });
    const covered = fontCodePoints(noticePdfArrayBuffer(doc));

    expect(covered.has('「'.codePointAt(0))).toBe(true);
    expect(covered.has('」'.codePointAt(0))).toBe(true);
    expect(covered.has('조'.codePointAt(0))).toBe(true);
  });

  it('상가 3기 연체에는 제10조의8 조항이 들어간다', () => {
    const commercial = buildNoticeContent(SAMPLES[1]);
    const basis = commercial.legalBasis.join(' | ');

    expect(commercial.arrears.met).toBe(true);
    expect(basis).toContain('제10조의8');
    expect(basis).toContain('3기의 차임액');
  });

  it('연체가 기준에 못 미치면 해지 조항 대신 지급 최고 조항을 쓴다', () => {
    const short = buildNoticeContent(SAMPLES[2]);

    expect(short.arrears.met).toBe(false);
    expect(short.arrears.shortage).toBe(2);
    expect(short.legalBasis.join(' ')).not.toContain('제10조의8');
  });
});
