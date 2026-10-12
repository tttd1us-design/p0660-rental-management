<script setup>
import { ref, computed } from 'vue';
import {
  computeMonthlyCost,
  computeLateFee,
  formatAmount,
} from '../lib/calculator.js';

/**
 * P-0660 임대관리 — 무료 체험용 계산기 2종 (Calculators)
 * ======================================================
 *
 * 화면(반응형 UI)과 계산 로직을 한데 묶은 단일 컴포넌트.
 * 계산 자체는 ../lib/calculator.js 의 순수 함수를 재사용한다.
 *
 * 1) 월세 계산기:  임대료 + 관리비 + 보증금 기회비용(월) = 월별 비용
 * 2) 연체이자 자동계산기:  미납 월세 × 법정이자율 × 연체일수 / 365
 */

// ── 월세 계산기 ──────────────────────────────────────────────────────
const rent = ref('');
const managementFee = ref('');
const deposit = ref('');
const annualRate = ref('');

const monthlyCost = computed(() =>
  computeMonthlyCost(rent.value, managementFee.value, deposit.value, annualRate.value),
);

// ── 연체이자 자동계산기 ──────────────────────────────────────────────
const unpaidRent = ref('');
const overdueDays = ref('');
const legalRate = ref('');

const lateFee = computed(() =>
  computeLateFee(unpaidRent.value, overdueDays.value, legalRate.value),
);
</script>

<template>
  <section class="calculators">
    <header>
      <h1>무료 체험용 계산기</h1>
      <p>두 가지 계산기로 임대·연체 비용을 미리 확인해 보세요.<br />
        모든 계산은 체험용 단순 산식이며 법률·세무 판단이 아닙니다.</p>
    </header>

    <div class="grid">
      <!-- ── 월세 계산기 ─────────────────────────── -->
      <article class="card">
        <h2>월세 계산기</h2>
        <p>임대료·관리비·보증금·이자율까지 반영해 <b>실질적인 월 고정비</b>를 계산합니다.</p>
        <div class="fields">
          <label class="field">
            <span>임대료(월세)</span>
            <input
              v-model="rent"
              type="number"
              min="0"
              step="1000"
              inputmode="numeric"
              placeholder="예: 1000000"
            />
          </label>
          <label class="field">
            <span>관리비</span>
            <input
              v-model="managementFee"
              type="number"
              min="0"
              step="1000"
              inputmode="numeric"
              placeholder="예: 150000"
            />
          </label>
          <label class="field">
            <span>보증금</span>
            <input
              v-model="deposit"
              type="number"
              min="0"
              step="1000000"
              inputmode="numeric"
              placeholder="예: 10000000"
            />
          </label>
          <label class="field">
            <span> 연이자율(%)</span>
            <input
              v-model="annualRate"
              type="number"
              min="0"
              max="20"
              step="0.1"
              inputmode="decimal"
              placeholder="예: 5"
            />
          </label>
        </div>
        <div class="result">
          <span class="result-label">월별 비용</span>
          <span class="result-value">{{ formatAmount(monthlyCost) }}원</span>
        </div>
        <p class="note">
          보증금 기회비용 = 보증금 × 연이자율 ÷ 12.
          <br />보증금을 묶어두는 대신 다른 곳에 투자했을 때 얻는 월 이자 상당액까지
          더한 월 고정비를 한눈에 비교하세요.
        </p>
      </article>

      <!-- ── 연체이자 자동계산기 ───────────────────── -->
      <article class="card">
        <h2>연체이자 자동계산기</h2>
        <p>미납 월세·연체일수·법정이자율로 <b>연체이자(단리)</b>를 계산합니다.</p>
        <div class="fields">
          <label class="field">
            <span>미납 월세</span>
            <input
              v-model="unpaidRent"
              type="number"
              min="0"
              step="1000"
              inputmode="numeric"
              placeholder="예: 1000000"
            />
          </label>
          <label class="field">
            <span>연체일수</span>
            <input
              v-model="overdueDays"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
              placeholder="예: 30"
            />
          </label>
          <label class="field">
            <span>법정이자율(%)</span>
            <input
              v-model="legalRate"
              type="number"
              min="0"
              max="20"
              step="0.1"
              inputmode="decimal"
              placeholder="예: 6"
            />
          </label>
        </div>
        <div class="result">
          <span class="result-label">연체이자</span>
          <span class="result-value">{{ formatAmount(lateFee) }}원</span>
        </div>
        <p class="note">
          산식: 미납 월세 × 법정이자율(%) ÷ 100 × 연체일수 ÷ 365.<br />
          (단리, 1년 = 365일. 민법상·상법 상사법정이율 연 5%·6% 기준의 단순 계산이며, 실제 법적 지연손해금과는 다를 수 있습니다.)
        </p>
      </article>
    </div>
  </section>
</template>

<style>
.calculators {
  max-width: 1060px;
  margin: 0 auto;
  padding: 32px 20px 48px;
}

.calculators header h1 {
  font-size: 24px;
  margin: 0 0 6px;
  letter-spacing: -0.5px;
}

.calculators header p {
  color: #666;
  font-size: 14px;
  margin: 0 0 24px;
  line-height: 1.6;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(17, 24, 39, 0.06);
}

.card h2 {
  font-size: 18px;
  margin: 0 0 4px;
  letter-spacing: -0.3px;
}

.card > p {
  color: #666;
  font-size: 14px;
  margin: 0 0 16px;
  line-height: 1.6;
}

.fields {
  display: grid;
  gap: 12px;
  margin-bottom: 18px;
}

.field {
  display: grid;
  gap: 4px;
}

.field span {
  font-size: 13px;
  color: #444;
  display: block;
}

.field input {
  grid-column: 1 / -1;
  padding: 10px 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  width: 100%;
  box-sizing: border-box;
  background: #fafafa;
}

.field input:focus {
  outline: 2px solid #6366f1;
  outline-offset: 1px;
  border-color: transparent;
  background: #ffffff;
}

.result {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 14px 16px;
  background: #f0f4ff;
  border-radius: 8px;
  border: 1px solid #d9e2ff;
}

.result-label {
  font-size: 14px;
  color: #666;
}

.result-value {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  font-variant-numeric: tabular-nums;
}

.note {
  margin: 12px 0 0;
  font-size: 12px;
  color: #8a8f98;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
