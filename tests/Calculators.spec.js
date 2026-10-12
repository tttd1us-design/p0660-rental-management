import { describe, it, expect } from 'vitest';
import {
  computeMonthlyCost,
  computeLateFee,
  formatAmount,
} from '../src/lib/calculator.js';

describe('월세 계산기 (computeMonthlyCost)', () => {
  it('임대료 + 관리비 + 보증금 기회비용으로 월별 비용을 계산한다', () => {
    const monthlyCost = computeMonthlyCost(1000000, 150000, 10000000, 5);
    // 1,000,000 + 150,000 + 10,000,000 × 0.05 ÷ 12
    expect(monthlyCost).toBe(1150000 + 10000000 * 0.05 / 12);
  });

  it('입력이 비면 0으로 처리한다', () => {
    expect(computeMonthlyCost('', null, undefined, '')).toBe(0);
    expect(computeMonthlyCost(null, null, null, null)).toBe(0);
  });

  it('이자율이 0이면 보증금 기회비용은 0이 된다', () => {
    expect(computeMonthlyCost(1000000, 150000, 10000000, 0)).toBe(1150000);
  });

  it('보증금이 0이면 보증금 기회비용이 없다', () => {
    expect(computeMonthlyCost(1000000, 150000, 0, 5)).toBe(1150000);
  });
});

describe('연체이자 자동계산기 (computeLateFee)', () => {
  it('미납 월세 × 이자율 × 일수 / 365 로 계산한다', () => {
    const lateFee = computeLateFee(1000000, 30, 6);
    // 1,000,000 × 0.06 × 30 ÷ 365 ≈ 4,931.51 → 반올림 4,932
    expect(lateFee).toBe(Math.round(1000000 * 0.06 * 30 / 365));
  });

  it('미납 금액이 0이면 연체이자도 0이다', () => {
    expect(computeLateFee(0, 30, 6)).toBe(0);
  });

  it('연체일수가 0이면 연체이자도 0이다', () => {
    expect(computeLateFee(1000000, 0, 6)).toBe(0);
  });

  it('연체일수에 비례해 연체이자가 늘어난다 (단리 산식)', () => {
    const thirty = computeLateFee(1000000, 30, 6);
    const sixty = computeLateFee(1000000, 60, 6);
    // 단리: 60일 = 30일 × 2. 반올림 전 값
    // 30일 → 1,000,000 × 0.06 × 30 ÷ 365 ≈ 4,931.5067 → 4,932
    // 60일 → 1,000,000 × 0.06 × 60 ÷ 365 ≈ 9,863.0136 → 9,863
    expect(thirty).toBe(Math.round(1000000 * 0.06 * 30 / 365));
    expect(sixty).toBe(Math.round(1000000 * 0.06 * 60 / 365));
  });

  it('미입력은 0으로 처리한다', () => {
    expect(computeLateFee('', null, undefined)).toBe(0);
  });
});

describe('formatAmount (천 단위 콤마 표시)', () => {
  it('천 단위 콤마를 붙인다', () => {
    expect(formatAmount(1234567)).toBe('1,234,567');
  });

  it('0은 "0"으로 표시한다', () => {
    expect(formatAmount(0)).toBe('0');
  });

  it('소수점 이하는 반올림한다', () => {
    expect(formatAmount(1234567.6)).toBe('1,234,568');
  });

  it('음수는 0으로 처리한다', () => {
    expect(formatAmount(-123)).toBe('0');
  });

  it('미입력은 "0"으로 처리한다', () => {
    expect(formatAmount('')).toBe('0');
  });
});
