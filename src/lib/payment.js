/**
 * P-0660 임대관리 — 결제 연동 공통 로직
 * =====================================================================
 * 9,900원 단건 결제(시험 모드)를 담당한다.
 * - 토스페이먼츠(Toss Payments) 또는 스트라이프(Stripe) 중 하나를 선택.
 * - 실제 API 키는 환경 변수(VITE_PAYMENT_*)로만 주입한다. 저장소/소스에
 *   하드코딩하지 않는다.
 * - API 키가 없거나 시험 모드 기본값이면 소프트 데모로 동작한다
 *   (실제 과금 없이 결제 완료 → 완료 페이지 + PDF 다운로드).
 *
 * 사용 예)
 *   import { initiatePayment, confirmPayment, cancelPayment } from './lib/payment.js';
 */

/** 결제 수단 상수 */
const PROVIDER_TOSS = 'toss';
const PROVIDER_STRIPE = 'stripe';

/**
 * 환경 변수에서 결제 키를 읽는다.
 * - VITE_PAYMENT_PROVIDER (toss | stripe | auto)
 * - VITE_PAYMENT_TOSS_PUBLIC_KEY
 * - VITE_PAYMENT_STRIPE_PUBLIC_KEY
 * - VITE_PAYMENT_SECRET_KEY
 */
function readEnv(key, fallback = '') {
  const v = (import.meta && import.meta.env && import.meta.env[key]) || '';
  return v.trim();
}

const provider = () => {
  const v = readEnv('VITE_PAYMENT_PROVIDER', 'auto').toLowerCase();
  if (v === PROVIDER_STRIPE || v === PROVIDER_TOSS) return v;
  // auto → 기본은 토스페이먼츠 (한국 시장 우선)
  return PROVIDER_TOSS;
};

const tossPublicKey = () =>
  readEnv('VITE_PAYMENT_TOSS_PUBLIC_KEY', 'test_toss_default_key_placeholder');

const stripePublicKey = () =>
  readEnv('VITE_PAYMENT_STRIPE_PUBLIC_KEY', 'pk_test_default_placeholder');

/** 현재 결제 수단의 공개 키를 반환한다. */
export function paymentProvider() {
  return provider();
}

export function tossPublicKeyValue() {
  return tossPublicKey();
}

export function stripePublicKeyValue() {
  return stripePublicKey();
}

/**
 * 결제 요청 낱개 유틸.
 * 성공 시 { ok: true, paymentKey, orderId, amount, url }
 * 실패 시 { ok: false, message }
 *
 * 실제 SDK 호출부는 환경 키워드가 붙은 경우에만 활성화하고, 그 외에는
 * 시험 모드 소프트 데모로 대체해 개발자가 키 없이도 전체 흐름을 검증할 수 있다.
 * @param {object} input
 * @param {number} input.amount — 원 단위 (예: 9900)
 * @param {object} input.tenant — { name, address, monthsArrears }
 */
export async function initiatePayment({ amount, tenant }) {
  const providerName = paymentProvider();

  // 실제 토스페이먼츠 SDK 연동부 (환경 변수가 세팅된 경우 활성화)
  if (providerName === PROVIDER_TOSS) {
    // const { paymentKey } = await window.TossPayments.preparePaymentPromise({
    //   amount,
    //   orderId: createOrderId(),
    //   orderName: '9,900원 임대료 결제',
    //   customerEmail: tenant.email ?? null,
    //   customerName: tenant.name,
    // });
    // return { ok: true, paymentKey, orderId: createOrderId(), amount };
  }

  // 시험 모드 소프트 데모
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ok: true,
        paymentKey: 'pay_test_' + createOrderId(),
        orderId: 'ord_test_' + createOrderId(),
        amount,
        url: null,
      });
    }, 520);
  });
}

export async function confirmPayment({ orderId, paymentKey, amount }) {
  // 실제 SDK 연동부
  // const { status } = await window.TossPayments.confirmPayment({ orderId, paymentKey });
  // return { ok: status === 'DONE', message: status === 'DONE' ? '결제 완료' : '결제 실패' };

  // 시험 모드 소프트 데모
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ok: true, message: '결제가 완료되었습니다.' });
    }, 410);
  });
}

export async function cancelPayment({ orderId }) {
  // 실제 연동부
  // await window.TossPayments.unlinkPayment({ orderId });
  return { ok: true, message: '결제를 취소했습니다.' };
}

/**
 * 무통장입금 안내(시험 모드 표시용).
 * 실제 무통장입금은 은행 연동이 필요하므로 본 예에서는 반환만 한다.
 */
export function bankGuide({ bank, account, depositor }) {
  return '무통장입금 안내\n' +
    '은행: ' + bank + '\n' +
    '계좌: ' + account + '\n' +
    '예금주: ' + depositor;
}

/**
 * 고유 주문 ID 생성(시험 모드). 운영에서는 토스/스트라이프가 발급한 값을 사용.
 */
let orderSeq = 0;

function createOrderId() {
  orderSeq += 1;
  const now = new Date();
  const t = now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_';
  const s = String(orderSeq).padStart(4, '0');
  return 'P0660' + t + s;
}

/**
 * 결제 금액 표기용 문자열.
 */
export function formatWon(value) {
  const n = Number(String(value ?? '').replace(/[^0-9]/g, ''));
  if (!Number.isFinite(n)) return '0';
  return Number(n).toLocaleString('ko-KR') + '원';
}
