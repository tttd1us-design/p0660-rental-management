/**
 * 브라우저가 실제로 밟는 경로를 그대로 흉내 내는 검증 스크립트.
 *
 * 브라우저는 폰트를 디스크에서 읽지 않고 웹 주소(/fonts/NanumGothic-Regular.ttf)로
 * 내려받는다. 이 스크립트는 개발 서버가 떠 있는 상태에서 같은 주소로 폰트를 받아
 * 내용증명 PDF 를 만들어, '실제 실행 경로'가 끝까지 동작하는지 확인한다.
 *
 * 실행:
 *   1) 다른 창에서  npx vite --port 5199   (개발 서버 실행)
 *   2) node scripts/probe_http_font.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createNoticePdf, noticePdfArrayBuffer, noticePdfFileName } from '../src/lib/noticePdf.js';
import { loadKoreanFontBase64, KOREAN_FONT_URL } from '../src/lib/koreanFont.js';

const BASE = process.env.PROBE_BASE_URL || 'http://localhost:5199';
const url = `${BASE}${KOREAN_FONT_URL}`;

// 브라우저 fetch 를 흉내 낸다(상대경로 → 절대주소).
const response = await fetch(url);
if (!response.ok) throw new Error(`폰트를 받지 못했습니다: ${url} (HTTP ${response.status})`);
const fontBase64 = await loadKoreanFontBase64(url);
console.log(`폰트 내려받기: HTTP ${response.status} · base64 ${fontBase64.length.toLocaleString()}자`);

const input = {
  tenantName: '홍길동',
  address: '서울특별시 강남구 테헤란로 1',
  monthsArrears: 3,
  accountNumber: '110-123-456789',
  leaseType: 'housing',
  landlordName: '김임대',
  landlordPhone: '010-1111-2222',
};

const doc = await createNoticePdf(input, { fontBase64 });
const bytes = noticePdfArrayBuffer(doc);
const head = String.fromCharCode(...new Uint8Array(bytes.slice(0, 5)));

mkdirSync('.probe', { recursive: true });
const out = '.probe/http_font.pdf';
writeFileSync(out, new Uint8Array(bytes));

const raw = Buffer.from(bytes).toString('latin1');
console.log(`파일명: ${noticePdfFileName(input)}`);
console.log(`쪽수: ${doc.getNumberOfPages()} · 크기: ${bytes.byteLength.toLocaleString()} bytes · 헤더: ${head}`);
console.log(`FontFile2(폰트 심김): ${raw.includes('FontFile2')}`);
console.log(`저장: ${out}`);
