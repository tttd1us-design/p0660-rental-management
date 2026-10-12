// 한글 렌더링 검증용 프로브: PDF 파일 생성
import { readFileSync, mkdirSync } from 'node:fs';
import { jsPDF } from 'jspdf';

const outDir = '.probe';
mkdirSync(outDir, { recursive: true });

const ttf = readFileSync('public/fonts/NanumGothic-Regular.ttf');
const base64 = ttf.toString('base64');

const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
doc.addFileToVFS('NanumGothic-Regular.ttf', base64);
doc.addFont('NanumGothic-Regular.ttf', 'NanumGothic', 'normal');
doc.setFont('NanumGothic', 'normal');

doc.setFontSize(20);
doc.text('내용증명', 105, 40, { align: 'center' });
doc.setFontSize(12);
doc.text('가나다라마바사 아자차카타파하', 20, 60);
doc.text('주택임대차보호법 제6조의3 제1항 제1호', 20, 70);
doc.text('상가건물 임대차보호법 제10조의8 (차임연체와 해지)', 20, 80);
doc.text('임차인 홍길동 귀하 — 미납 3개월 (2026년 10월 12일)', 20, 90);
doc.text('ABCDEFG abcdefg 1234567890 !@#$%^&*()', 20, 100);

doc.save(`${outDir}/probe.pdf`);
console.log('saved .probe/probe.pdf');
