# [1주차] 배포 URL 확보 — 완료 보고

## 배포 URL (임시, 56분 후 만료)
- **URL:** `https://temporary-swift-drizzle-kwtywj5.vercel.app`
- **HTTP 상태:** `200 OK` (외부 접근 확인 완료)
- **콘텐츠 길이:** `426 B` (배포된 `dist/index.html`과 일치)

## 가동 시작일
- **2026-10-12**

## 현재 단계: 시험 모드 소프트 데모
- 결제: 실제 과금 없음 (하드코딩된 테스트 키만 사용, 실제 SDK 호출은 주석 처리)
- 환경 변수: `VITE_PAYMENT_*` 부재 → 소프트 데모 동작
- 실제 결제 처리 없음, 마감일: 2026-10-13까지

## 배포 방식
- **Vercel CLI 63.1.2** 사용 (`npx vercel deploy --temporary --prod`)
- 인증 없이 임시 배포 생성 (배포 토큰은 저장하지 않음 — 필요 시 대표님 승인 후)
- 배포물: `dist/` 폴더 (Vite + Vue SPA, 한글 폰트 포함)

## 남은 작업 (2주차)
- [ ] Vercel 계정 로그인 후 프로젝트 이름 `p0660-<id>`로 고정
- [ ] 임시 배포 영구화 (claim 또는 새 배포 생성)
- [ ] GA4 (`gtag`) 설치 — 별도 카드에서 진행

## 배포된 파일 확인
- `index.html` — Vue SPA 진입점
- `assets/index-BRHMK35h.js` — 빌드된 앱 코드 (Vue 컴포넌트·폰트·PDF 생성)
- `assets/index-RYKAqDfz.css` — 스타일
- `fonts/NanumGothic-Regular.ttf` — 한글 폰트 (내용증명 PDF용, 2.0MB)
