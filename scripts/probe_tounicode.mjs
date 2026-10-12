import { readFileSync } from 'node:fs';
import { createNoticePdf, noticePdfArrayBuffer } from '../src/lib/noticePdf.js';

const fontBase64 = readFileSync(
  new URL('../public/fonts/NanumGothic-Regular.ttf', import.meta.url),
).toString('base64');

const doc = await createNoticePdf(
  {
    tenantName: '홍길동',
    address: '서울특별시 강남구 테헤란로 123',
    monthsArrears: '3',
    accountNumber: '110-123-456789',
    leaseType: 'housing',
    landlordName: '김임대',
  },
  { fontBase64 },
);

const bytes = Buffer.from(noticePdfArrayBuffer(doc));
const s = bytes.toString('latin1');

console.log('PDF bytes:', bytes.length);
console.log('Header:', s.slice(0, 8));
for (const [ch, hex] of [['한', 'D55C'], ['증', 'C99D'], ['명', 'BA85'], ['차', 'CC28'], ['임', 'C784'], ['홍', 'D64D']]) {
  console.log(`글자 ${ch} (${hex}) — raw:${s.includes(hex)} angle:${s.includes(`<${hex}>`)}`);
}
console.log('FontFile2:', s.includes('FontFile2'));
console.log('ToUnicode:', s.includes('/ToUnicode'));
console.log('NanumGothic:', s.includes('NanumGothic'));
console.log('Helvetica:', s.includes('Helvetica'));

const i = s.indexOf('beginbfchar');
console.log('--- bfchar snippet ---');
if (i >= 0) console.log(JSON.stringify(s.slice(Math.max(0, i - 120), i + 400)));
