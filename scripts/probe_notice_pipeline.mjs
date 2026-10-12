// 모듈 통합 검증: 실제 내용증명 PDF 를 만들어 렌더 확인까지
import { readFileSync, mkdirSync } from 'node:fs';
import { createNoticePdf, noticePdfFileName, noticePdfArrayBuffer } from '../src/lib/noticePdf.js';

const outDir = '.probe';
mkdirSync(outDir, { recursive: true });

const fontBase64 = readFileSync('public/fonts/NanumGothic-Regular.ttf').toString('base64');

const samples = [
  {
    name: 'housing',
    input: {
      tenantName: '홍길동',
      address: '서울특별시 강남구 테헤란로 123, 401호',
      monthsArrears: 3,
      accountNumber: '110-123-456789',
      leaseType: 'housing',
      landlordName: '김임대',
      landlordAddress: '서울특별시 서초구 반포대로 1',
      landlordPhone: '010-1234-5678',
      monthlyRent: 800000,
      deposit: 20000000,
      issueDate: '2026-10-12',
    },
  },
  {
    name: 'commercial',
    input: {
      tenantName: '박상가',
      address: '부산광역시 해운대구 센텀중앙로 90, 1층 상가',
      monthsArrears: 3,
      accountNumber: '111-222-333333',
      leaseType: 'commercial',
      landlordName: '이건물',
      monthlyRent: 1500000,
      issueDate: '2026-10-12',
    },
  },
];

for (const sample of samples) {
  const doc = await createNoticePdf(sample.input, { fontBase64 });
  const bytes = noticePdfArrayBuffer(doc);
  const fileName = noticePdfFileName(sample.input);
  const outPath = `${outDir}/${sample.name}.pdf`;
  const buffer = Buffer.from(bytes);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(outPath, buffer);

  const header = buffer.subarray(0, 5).toString('latin1');
  const pageCount = doc.getNumberOfPages();
  console.log(`[${sample.name}] 파일명=${fileName} 페이지=${pageCount} 바이트=${buffer.length} 헤더=${header} FontFile2=${buffer.includes('FontFile2')}`);
  console.log(`  저장: ${outPath}`);
}
