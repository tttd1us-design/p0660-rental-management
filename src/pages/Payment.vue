<script setup>
import { ref } from 'vue';
import { initiatePayment, confirmPayment, cancelPayment, bankGuide, formatWon } from '../lib/payment.js';

const amount = 9900;
const step = ref('method'); // method(수단선택) | pay(결제중) | complete(완료) | error(오류)
const provider = ref('toss'); // toss | stripe
const tenant = ref({ name: '', address: '', monthsArrears: '' });
const result = ref('');
const error = ref('');
const busy = ref(false);

/** 시험 모드: 실제 API 키 없이 소프트 데모 동작. */
const isTestMode = () => !import.meta.env.VITE_PAYMENT_PROVIDER;

function goBack() {
  step.value = 'method';
  error.value = '';
  result.value = '';
  busy.value = false;
}

async function startPayment() {
  if (busy.value) return;
  if (!tenant.value.name || !tenant.value.address || !tenant.value.monthsArrears) {
    error.value = '결제 전 1단계(입력 폼) 정보를 먼저 입력해 주세요.';
    step.value = 'error';
    return;
  }
  busy.value = true;
  error.value = '';
  result.value = '';
  try {
    const init = await initiatePayment({ amount, tenant: tenant.value });
    if (!init.ok) {
      throw new Error(init.message || '결제 요청을 시작하지 못했습니다.');
    }
    step.value = 'pay';
    result.value = '결제 수단: ' + provider.value + ' / 금액: ' + formatWon(amount);
    result.value += '\n주문번호: ' + init.orderId;
    result.value += '\n잠시만 기다려 주세요...';
  } catch (e) {
    error.value = e.message || '결제 요청에 실패했습니다.';
    step.value = 'error';
  } finally {
    busy.value = false;
  }
}

async function finishPayment() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const res = await confirmPayment({ orderId: 'ord_test_' + Date.now(), paymentKey: 'pay_test_' + Date.now(), amount });
    if (!res.ok) {
      throw new Error(res.message || '결제 확인에 실패했습니다.');
    }
    step.value = 'complete';
    result.value = res.message || '결제가 완료되었습니다.';
    result.value += '\n\n아래 PDF를 내려받아 독촉 증빙으로 보관하세요.';
  } catch (e) {
    error.value = e.message || '결제 완료 처리 중 오류가 발생했습니다.';
    step.value = 'error';
  } finally {
    busy.value = false;
  }
}

async function downloadPdf() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const { createNoticePdf, noticePdfBlob } = await import('../lib/noticePdf.js');
    const date = new Date();
    const input = {
      tenantName: tenant.value.name,
      address: tenant.value.address,
      monthsArrears: tenant.value.monthsArrears,
      issueDate: date,
      type: Number(tenant.value.monthsArrears) >= 2 ? 'housing' : 'commercial',
    };
    const doc = await createNoticePdf(input);
    const blob = noticePdfBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '완납독촉장_' + tenant.value.name + '_' + date.toISOString().slice(0, 10) + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    result.value = '결제 완료 + PDF 다운로드 준비가 끝났습니다.';
  } catch (e) {
    error.value = 'PDF 생성에 실패했습니다: ' + e.message;
  } finally {
    busy.value = false;
  }
}

function selectProvider(v) {
  provider.value = v;
}
</script>

<template>
  <div id="app">
    <header class="app-header">
      <h1>P-0660 임대관리 — 9,900원 결제</h1>
      <p class="sub">토스페이먼츠 / 스트라이프 시험 모드 연동</p>
    </header>

    <!-- 1단계: 결제 수단 선택 -->
    <section v-if="step === 'method'" class="card">
      <h2>결제 수단 선택</h2>
      <p class="note">시험 모드에서는 실제 과금 없이 결제 흐름을 검증합니다.</p>
      <div class="btn-group">
        <button :class="{ active: provider === 'toss' }" @click="selectProvider('toss')">토스페이먼츠 (한국)</button>
        <button :class="{ active: provider === 'stripe' }" @click="selectProvider('stripe')">스트라이프 (글로벌)</button>
      </div>
      <div class="info-line">
        <span>결제 금액</span>
        <strong>{{ formatWon(amount) }}</strong>
        <span class="hint">(월 임대료 + 관리비가 아닐 경우 9,900원으로 고정)</span>
      </div>
      <p class="hint">실제 운영 시 API 키는 환경 변수(VITE_PAYMENT_*)로만 주입한다. 하드코딩 금지.</p>
      <button class="btn primary" @click="startPayment()" :disabled="busy">
        {{ busy ? '결제 요청 중...' : '9,900원 결제하기' }}
      </button>
      <p v-if="isTestMode()" class="hint" style="color:#888">
        시험 모드: 환경 변수가 비어 있어 소프트 데모로 동작합니다. 실제 키를 세팅하면
        해당 SDK 호출부가 활성화됩니다.
      </p>
    </section>

    <!-- 2단계: 결제 진행 -->
    <section v-if="step === 'pay'" class="card">
      <h2>결제 진행 중</h2>
      <p class="note">{{ result }}</p>
      <div class="spinner"></div>
      <p class="hint">결제 승인 후 자동으로 완료 화면으로 전환됩니다.</p>
    </section>

    <!-- 3단계: 결제 완료 -->
    <section v-if="step === 'complete'" class="card success">
      <h2>결제 완료</h2>
      <p class="note">{{ result }}</p>
      <button class="btn primary" @click="downloadPdf()" :disabled="busy">
        {{ busy ? 'PDF 생성 중...' : '완납 독촉 PDF 받기' }}
      </button>
      <button class="btn ghost" @click="goBack()">뒤로 (입력 폼)</button>
    </section>

    <!-- 4단계: 오류 -->
    <section v-if="step === 'error'" class="card error">
      <h2>오류</h2>
      <p class="note">{{ error }}</p>
      <button class="btn" @click="goBack()">확인</button>
    </section>
  </div>
</template>

<style>
.app-header {
  background: #1f2937;
  color: #fff;
  padding: 1.25rem 1.5rem;
  border-radius: 8px;
}
.app-header h1 { margin: 0 0 .25rem; font-size: 1.35rem; }
.app-header .sub { margin: 0; color: #d1d5db; font-size: .9rem; }
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  max-width: 560px;
  margin: 1rem auto;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
.card h2 { margin-top: 0; font-size: 1.15rem; }
.card .note { white-space: pre-line; margin: .5rem 0; }
.card .hint { color: #6b7280; font-size: .85rem; line-height: 1.5; }
.card.success { border-color: #86efac; background: #f0fdf4; }
.card.error { border-color: #fca5a5; background: #fef2f2; }
.btn-group { display: flex; gap: .75rem; margin-bottom: 1rem; flex-wrap: wrap; }
.btn-group button {
  flex: 1 1 48%;
  padding: .75rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: .95rem;
}
.btn-group button.active {
  background: #1f2937;
  color: #fff;
  border-color: #1f2937;
}
.btn {
  display: inline-block;
  padding: .7rem 1.2rem;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #fff;
  cursor: pointer;
  font-size: .95rem;
  margin-top: .75rem;
}
.btn.primary { background: #1f2937; color: #fff; border-color: #1f2937; }
.btn.primary:disabled { opacity: .6; cursor: not-allowed; }
.btn.ghost { background: transparent; }
.btn.success { background: #16a34a; color: #fff; border-color: #16a34a; }
.btn.error { background: #dc2626; color: #fff; border-color: #dc2626; }
.spinner {
  width: 28px; height: 28px;
  border: 3px solid #e5e7eb;
  border-top-color: #1f2937;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 1rem auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
