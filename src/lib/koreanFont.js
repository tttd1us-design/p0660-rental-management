/**
 * P-0660 임대관리 — 한글 폰트 임베딩 (koreanFont)
 * ==============================================
 *
 * jsPDF는 기본 내장 폰트(Helvetica 등)로 한글을 그리지 못한다.
 * 한글이 네모(□)로 깨지지 않게 하려면 TrueType 폰트(.ttf)를 PDF 안에 '심어야' 한다.
 *
 * 이 파일은 그 작업을 담당한다.
 *  1. public/fonts/NanumGothic-Regular.ttf 를 불러와 base64 문자열로 바꾼다.
 *  2. jsPDF 문서에 폰트를 등록하고(가상 파일 시스템 + 폰트 등록) 바로 사용할 수 있게 한다.
 *
 * 폰트: 나눔고딕(NanumGothic) — SIL Open Font License 1.1 (상업적 사용 가능, 재배포 가능)
 *      원본: https://github.com/google/fonts/tree/main/ofl/nanumgothic
 *
 * ※ 이 모듈은 브라우저(fetch)에서 쓰도록 만들었다. Node 테스트처럼 파일을 직접
 *    읽어야 하는 환경에서는 base64 문자열을 만들어 registerKoreanFont()에 넘기면 된다.
 */

/** PDF에 등록할 폰트 패밀리 이름(본문에서 setFont 할 때 쓰는 이름) */
export const KOREAN_FONT_FAMILY = 'NanumGothic';

/** jsPDF 가상 파일 시스템에 넣을 파일 이름 */
export const KOREAN_FONT_FILE = 'NanumGothic-Regular.ttf';

/** 웹에서 폰트를 내려받을 경로(Vite public 폴더 기준) */
export const KOREAN_FONT_URL = '/fonts/NanumGothic-Regular.ttf';

/** 기본 폰트 설정 묶음 */
export const DEFAULT_KOREAN_FONT = Object.freeze({
  family: KOREAN_FONT_FAMILY,
  fileName: KOREAN_FONT_FILE,
  url: KOREAN_FONT_URL,
  license: 'SIL Open Font License 1.1 (NanumGothic)',
});

/** ArrayBuffer(Uint8Array) → base64 문자열 (브라우저·Node 공용) */
export function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  if (typeof btoa === 'function') return btoa(binary);
  if (typeof Buffer !== 'undefined') return Buffer.from(binary, 'binary').toString('base64');
  throw new Error('이 환경에서는 base64 인코딩을 할 수 없습니다.');
}

/**
 * jsPDF 문서에 한글 폰트를 등록한다.
 * normal/bold 두 스타일 모두 같은 파일을 등록하여, 어느 쪽을 지정해도 한글이 깨지지 않게 한다.
 *
 * @param {object} doc jsPDF 인스턴스
 * @param {string} base64 폰트 파일의 base64 문자열
 * @param {{family?:string, fileName?:string}} [options]
 */
export function registerKoreanFont(doc, base64, options = {}) {
  if (!doc || typeof doc.addFileToVFS !== 'function' || typeof doc.addFont !== 'function') {
    throw new Error('registerKoreanFont: jsPDF 문서 객체가 아닙니다.');
  }
  if (typeof base64 !== 'string' || base64.length < 100) {
    throw new Error('registerKoreanFont: 폰트 base64 문자열이 비어 있습니다.');
  }

  const family = options.family || KOREAN_FONT_FAMILY;
  const fileName = options.fileName || KOREAN_FONT_FILE;

  doc.addFileToVFS(fileName, base64);
  doc.addFont(fileName, family, 'normal');
  doc.addFont(fileName, family, 'bold');
  doc.setFont(family, 'normal');
  return doc;
}

/**
 * 웹(브라우저)에서 폰트 파일을 받아 base64로 돌려준다.
 * @param {string} [url]
 * @returns {Promise<string>}
 */
export async function loadKoreanFontBase64(url = KOREAN_FONT_URL) {
  if (typeof fetch !== 'function') {
    throw new Error(
      '한글 폰트를 불러올 수 없습니다(fetch 미지원 환경). fontBase64 옵션으로 직접 전달하세요.',
    );
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`한글 폰트 로드 실패: ${url} (HTTP ${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  return arrayBufferToBase64(buffer);
}
