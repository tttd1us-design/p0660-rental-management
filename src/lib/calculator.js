/**
 * P-0660 임대관리 — 무료 체험용 계산기 공통 로직
 * =================================================
 *
 * SEO 유입을 위한 무료 체험용 계산기 2종의 계산 엔진을 담당한다.
 * 화면(UI)과 무관하게 순수 함수로만 작성하여 단위 테스트가 쉽도록 한다.
 *
 * 1. 월세 계산기
 *    월별 비용 = 임대료 + 관리비 + (보증금 × 연이자율 / 12)
 *    -> 보증금을 묶는 데 드는 기회비용을 월 단위로 환산한다.
 *
 * 2. 연체이자 자동계산기
 *    연체이자 = 미납 월세 × 법정이자율 × 연체일수 / 365
 *    -> 단리(1년 = 365일)로 계산한다. 민법상·상법 상사법정이율
 *       (연 5%·6%)을 기준으로 하며, 사용자가 직접 법정이자율을
 *       입력할 수 있다.
 *
 * ※ 법률·세무 판단이 아닌, 공개 정보 기반의 체험용 계산이다.
 *    실제 법적 절차와는 다를 수 있으므로 반드시 전문가 확인을 받는다.
 */

/** 문자열을 숫자로 변환. 실패·음수·빈 값은 0으로 처리한다. */
export function toNonNegativeInt(value) {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

/**
 * 숫자(금액·일수·비율)를 천 단위 콤마로 표시한다.
 * 0 → "0", 소수점 이하는 반올림한다.
 * 예: 1234567 → "1,234,567"  /  0 → "0"  /  1234567.6 → "1,234,568"
 */
export function formatAmount(value) {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(Math.max(0, n));
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 월별 비용 계산.
 * @param {number|string} monthlyRent  임대료(월세)
 * @param {number|string} managementFee  관리비
 * @param {number|string} deposit  보증금
 * @param {number|string} annualRate  연이자율(%)  (연 5% = 5)
 * @returns {number} 월별 비용(원)
 */
export function computeMonthlyCost(monthlyRent, managementFee, deposit, annualRate) {
  const rent = toNonNegativeInt(monthlyRent);
  const fee = toNonNegativeInt(managementFee);
  const depositAmount = toNonNegativeInt(deposit);
  const rate = toNonNegativeInt(annualRate) / 100 / 12;
  return rent + fee + depositAmount * rate;
}

/**
 * 연체이자 계산 (단리, 1년 = 365일).
 * @param {number|string} unpaidRent  미납 월세
 * @param {number|string} overdueDays  연체일수
 * @param {number|string} legalRate  법정이자율(%)  (연 6% = 6)
 * @returns {number} 연체이자(원, 정수)
 */
export function computeLateFee(unpaidRent, overdueDays, legalRate) {
  const rent = toNonNegativeInt(unpaidRent);
  const days = toNonNegativeInt(overdueDays);
  const rate = toNonNegativeInt(legalRate) / 100;
  return Math.round(rent * rate * days / 365);
}
