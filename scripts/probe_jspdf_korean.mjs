// jsPDF v4 + 한글 TTF 임베딩 동작 확인용 임시 프로브
import { readFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';

const ttf = readFileSync('public/fonts/NanumGothic-Regular.ttf');
const base64 = ttf.toString('base64');

const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
doc.addFileToVFS('NanumGothic-Regular.ttf', base64);
doc.addFont('NanumGothic-Regular.ttf', 'NanumGothic', 'normal');
doc.setFont('NanumGothic', 'normal');
doc.setFontSize(14);
doc.text('내용증명 — 한글 폰트 임베딩 확인 가나다라 123', 20, 30);
doc.text('주택임대차보호법 제6조의3 제1항 제1호', 20, 40);

const out = doc.output('arraybuffer');
const head = new TextDecoder().decode(new Uint8Array(out).slice(0, 5));
console.log('PDF 헤더:', head);
console.log('PDF 바이트 수:', out.byteLength);

// 폰트가 실제로 PDF에 임베딩되었는지(=문자열 이름이 들어있는지) 대략 확인
const utf8 = Buffer.from(out).toString('latin1');
console.log('FontFile2 포함:', utf8.includes('FontFile2'));
console.log('NanumGothic 이름 포함:', utf8.includes('NanumGothic'));
