import { describe, it, expect } from 'vitest';
import {
  paymentProvider,
  formatWon,
  bankGuide,
  initiatePayment,
  confirmPayment,
  cancelPayment,
} from '../src/lib/payment.js';

describe('payment — 기본 유틸', () => {
  it('paymentProvider() 는 미설정 시 토스페이먼츠(기본값)를 반환한다', () => {
    // 실제 Vite 환경에서는 import.meta.env 가 비어있지 않을 수 있으므로
    // 테스트 전용으로 환경 변수를 초기화한 뒤 복원한다.
    const prev = process.env.VITE_PAYMENT_PROVIDER;
    delete process.env.VITE_PAYMENT_PROVIDER;
    expect(paymentProvider()).toBe('toss');
    if (prev !== undefined) process.env.VITE_PAYMENT_PROVIDER = prev;
    else delete process.env.VITE_PAYMENT_PROVIDER;
  });

  it('formatWon 은 천 단위 콤마를 붙인다', () => {
    expect(formatWon(0)).toBe('0원');
    expect(formatWon(9900)).toBe('9,900원');
    expect(formatWon(1234567)).toBe('1,234,567원');
  });

  it('bankGuide 는 무통장입금 안내를 반환한다', () => {
    const g = bankGuide({ bank: '카카오뱅크', account: '123-456-789012', depositor: '홍길동' });
    expect(g).toContain('카카오뱅크');
    expect(g).toContain('123-456-789012');
    expect(g).toContain('홍길동');
  });
});

describe('payment — 시험 모드 소프트 데모', () => {
  it('initiatePayment 는 성공 응답을 반환한다', async () => {
    const res = await initiatePayment({ amount: 9900, tenant: { name: '홍길동', address: '서울', monthsArrears: '3' } });
    expect(res.ok).toBe(true);
    expect(res.amount).toBe(9900);
    expect(res.paymentKey).toMatch(/^pay_test_/);
    expect(res.orderId).toMatch(/^ord_test_/);
  });

  it('confirmPayment 는 성공 응답을 반환한다', async () => {
    const res = await confirmPayment({
      orderId: 'ord_test_0001',
      paymentKey: 'pay_test_0001',
      amount: 9900,
    });
    expect(res.ok).toBe(true);
    expect(res.message).toContain('완료');
  });

  it('cancelPayment 는 성공 응답을 반환한다', async () => {
    const res = await cancelPayment({ orderId: 'ord_test_0001' });
    expect(res.ok).toBe(true);
    expect(res.message).toContain('취소');
  });
});
