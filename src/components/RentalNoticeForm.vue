<script setup>
import { ref, computed, watch } from 'vue';
import { buildNoticeContent } from '../lib/legalEngine.js';
import { downloadNoticePdf } from '../lib/noticePdf.js';

/**
 * P-0660 임대관리 4단계 입력 폼
 *
 * 단계 구성
 *  1단계: 미납 감지 (D+1) — 세입자·미납 정보 입력
 *  2단계: 카톡/문자 고지서 — 입력 정보 기반 통보문 생성
 *  3단계: 내용증명 PDF 생성 — 발송용 내용증명 미리보기
 *  4단계: 명도소송/지급명령 연결 — 다음 법적 절차 안내
 */
const STEPS = [
  { id: 1, title: '미납 감지', subtitle: 'D+1 · 미납 정보 입력', icon: '📋' },
  { id: 2, title: '부드러운 독촉', subtitle: '카톡 · 문자 고지서', icon: '✉️' },
  { id: 3, title: '법적 경고', subtitle: '내용증명 PDF 생성', icon: '📄' },
  { id: 4, title: '법적 절차', subtitle: '명도소송 · 지급명령 연결', icon: '⚖️' },
];

const step = ref(1);

const tenantName = ref('');
const address = ref('');
const monthsArrears = ref('');
const accountNumber = ref('');
// 임대차 유형(주택/상가) — 유형에 따라 자동 삽입되는 법령 조항이 달라진다. 기본은 주택.
const leaseType = ref('housing');
// 임대인(발신인) 정보 — 선택 입력. 비워 두면 기본값으로 채운다.
const landlordName = ref('');
const landlordPhone = ref('');

const errors = ref({
  tenantName: '',
  address: '',
  monthsArrears: '',
  accountNumber: '',
});

const progress = computed(() => {
  const total = STEPS.length;
  return ((step.value - 1) / total) * 100;
});

const showStep = (id) => step.value === id;

// 숫자 입력(number)은 v-model이 number로 바뀔 수 있으므로 항상 문자열로 다룬다.
const asText = (value) => (value === null || value === undefined ? '' : String(value)).trim();

const validateStep1 = () => {
  let valid = true;
  const nextErrors = { ...errors.value };

  if (!asText(tenantName.value)) {
    nextErrors.tenantName = '세입자명을 입력해 주세요.';
    valid = false;
  }
  if (!asText(address.value)) {
    nextErrors.address = '주소를 입력해 주세요.';
    valid = false;
  }
  if (!asText(monthsArrears.value)) {
    nextErrors.monthsArrears = '미납 개월수를 입력해 주세요.';
    valid = false;
  } else {
    const months = Number(asText(monthsArrears.value));
    if (!Number.isFinite(months) || months <= 0 || !Number.isInteger(months)) {
      nextErrors.monthsArrears = '미납 개월수는 1 이상의 정수여야 해요.';
      valid = false;
    }
  }
  if (!asText(accountNumber.value)) {
    nextErrors.accountNumber = '계좌번호를 입력해 주세요.';
    valid = false;
  } else {
    const digits = asText(accountNumber.value).replace(/[^\d]/g, '');
    if (digits.length < 9) {
      nextErrors.accountNumber = '계좌번호는 9자리 이상이어야 해요.';
      valid = false;
    }
  }

  errors.value = nextErrors;
  return valid;
};

const nextStep = () => {
  if (step.value === 1 && !validateStep1()) return;
  if (step.value < STEPS.length) {
    step.value += 1;
  }
};

const prevStep = () => {
  if (step.value > 1) {
    step.value -= 1;
  }
};

const resetForm = () => {
  tenantName.value = '';
  address.value = '';
  monthsArrears.value = '';
  accountNumber.value = '';
  leaseType.value = 'housing';
  landlordName.value = '';
  landlordPhone.value = '';
  pdfMessage.value = '';
  pdfError.value = '';
  errors.value = {
    tenantName: '',
    address: '',
    monthsArrears: '',
    accountNumber: '',
  };
  step.value = 1;
};

const isFilled = computed(() => {
  return [
    tenantName.value,
    address.value,
    monthsArrears.value,
    accountNumber.value,
  ].every((field) => asText(field) !== '');
});

const letterText = computed(() => {
  if (!isFilled.value) return '';
  const months = Number(asText(monthsArrears.value));
  return [
    '임대인은 아래 임차인에게 임대물건을 반환하여 줄 것을 최고합니다.',
    '',
    '1. 임차인: ' + asText(tenantName.value),
    '2. 주소: ' + asText(address.value),
    '3. 미납 기간: ' + months + '개월',
    '4. 해당 금액 미지급 시, 임대인은 부득이 법적 절차(내용증명 발송, 명도소송, 지급명령 등)에 나아갈 수 있습니다.',
    '',
    '2026년 10월',
    '임대인 귀하',
  ].join('\n');
});

/**
 * 3단계에서 쓰는 내용증명 구조.
 * 입력값을 legalEngine 에 넣으면, 연체 개월수와 임대차 유형에 맞는
 * 법령 조항(민법 제640조 · 주택임대차보호법 · 상가건물 임대차보호법)이 자동으로 채워진다.
 */
const notice = computed(() => {
  if (!isFilled.value) return null;
  return buildNoticeContent({
    tenantName: asText(tenantName.value),
    address: asText(address.value),
    monthsArrears: asText(monthsArrears.value),
    accountNumber: asText(accountNumber.value),
    leaseType: leaseType.value,
    landlordName: asText(landlordName.value),
    landlordPhone: asText(landlordPhone.value),
  });
});

const pdfBusy = ref(false);
const pdfMessage = ref('');
const pdfError = ref('');

/** 3단계: 내용증명 PDF 를 만들어 바로 내려받는다. */
const downloadPdf = async () => {
  if (pdfBusy.value || !notice.value) return;
  pdfBusy.value = true;
  pdfMessage.value = '';
  pdfError.value = '';
  try {
    const { fileName } = await downloadNoticePdf({
      tenantName: asText(tenantName.value),
      address: asText(address.value),
      monthsArrears: asText(monthsArrears.value),
      accountNumber: asText(accountNumber.value),
      leaseType: leaseType.value,
      landlordName: asText(landlordName.value),
      landlordPhone: asText(landlordPhone.value),
    });
    pdfMessage.value = `내용증명 PDF를 저장했습니다: ${fileName}`;
  } catch (error) {
    pdfError.value = `PDF 생성에 실패했습니다: ${error.message}`;
  } finally {
    pdfBusy.value = false;
  }
};

watch(
  () => step.value,
  (current) => {
    if (current === 4) {
      console.warn('4단계 완료 — 명도소송/지급명령 연결 단계에서 다음 조치를 진행할 수 있습니다.');
    }
  },
);
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>임대관리 입력 폼</h1>
      <p class="subtitle">
        P-0660 — 미납 감지부터 법적 절차까지 4단계로 안내하는 입력 화면
      </p>
    </header>

    <!-- 단계 진행 표시기 -->
    <section
      class="progress-section"
      aria-label="진행 단계"
    >
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: progress + '%' }"
        />
      </div>
      <ol class="step-list">
        <li
          v-for="s in STEPS"
          :key="s.id"
          class="step-item"
          :class="{ active: showStep(s.id), done: step.value > s.id }"
        >
          <span class="step-number">{{ s.id }}</span>
          <span class="step-label">
            <span class="step-title">{{ s.title }}</span>
            <span class="step-subtitle">{{ s.subtitle }}</span>
          </span>
        </li>
      </ol>
    </section>

    <!-- 본문 -->
    <main class="content">
      <!-- 1단계: 미납 감지 -->
      <div
        v-if="showStep(1)"
        class="card"
      >
        <h2 class="step-title-large">
          {{ STEPS[0].title }}
        </h2>
        <p class="step-subtitle-large">
          {{ STEPS[0].subtitle }}
        </p>

        <form
          class="form"
          novalidate
          @submit.prevent="nextStep"
        >
          <div class="field">
            <label for="tenantName">세입자명 *</label>
            <input
              id="tenantName"
              v-model="tenantName"
              type="text"
              placeholder="예: 홍길동"
              autocomplete="off"
            >
            <p class="error">
              {{ errors.tenantName }}
            </p>
          </div>

          <div class="field">
            <label for="address">주소(소재지) *</label>
            <input
              id="address"
              v-model="address"
              type="text"
              placeholder="예: 경기도 안양시 동안구 평촌대로 214"
              autocomplete="off"
            >
            <p class="error">
              {{ errors.address }}
            </p>
          </div>

          <div class="field">
            <label for="monthsArrears">미납 개월수 *</label>
            <input
              id="monthsArrears"
              v-model="monthsArrears"
              type="number"
              min="1"
              max="120"
              placeholder="예: 2"
            >
            <p class="error">
              {{ errors.monthsArrears }}
            </p>
          </div>

          <div class="field">
            <label for="accountNumber">계좌번호 *</label>
            <input
              id="accountNumber"
              v-model="accountNumber"
              type="text"
              placeholder="예: 123-456-7890123 (또는 은행+계좌)"
              autocomplete="off"
            >
            <p class="hint">
              숫자만 입력해도 자동으로 인식됩니다.
            </p>
            <p class="error">
              {{ errors.accountNumber }}
            </p>
          </div>

          <div class="field">
            <label for="leaseType">임대차 유형 *</label>
            <select
              id="leaseType"
              v-model="leaseType"
            >
              <option value="housing">
                주택 (주택임대차보호법 · 2기 연체 기준)
              </option>
              <option value="commercial">
                상가 (상가건물 임대차보호법 · 3기 연체 기준)
              </option>
            </select>
            <p class="hint">
              유형에 따라 자동으로 들어가는 법령 조항이 달라집니다.
            </p>
          </div>

          <div class="field">
            <label for="landlordName">임대인명 (선택)</label>
            <input
              id="landlordName"
              v-model="landlordName"
              type="text"
              placeholder="예: 김임대"
              autocomplete="off"
            >
            <p class="hint">
              비워 두면 '임대인'으로 표기됩니다.
            </p>
          </div>

          <div class="field">
            <label for="landlordPhone">임대인 연락처 (선택)</label>
            <input
              id="landlordPhone"
              v-model="landlordPhone"
              type="text"
              placeholder="예: 010-1234-5678"
              autocomplete="off"
            >
          </div>

          <div class="actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click="prevStep"
            >
              이전
            </button>
            <button
              type="submit"
              class="btn btn-primary"
            >
              미납 감지 시작
            </button>
          </div>
        </form>
      </div>

      <!-- 2단계: 카톡/문자 고지서 -->
      <div
        v-if="showStep(2)"
        class="card"
      >
        <h2 class="step-title-large">
          {{ STEPS[1].title }}
        </h2>
        <p class="step-subtitle-large">
          {{ STEPS[1].subtitle }}
        </p>

        <p class="intro">
          입력하신 정보를 바탕으로 아래 형태의 카톡/문자 고지서를 만듭니다.
        </p>

        <article class="notice">
          <header class="notice-header">
            <span class="notice-type">📱 문자 · 카톡 고지</span>
            <span class="notice-date">{{ new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) }}</span>
          </header>
          <p class="notice-body">
            {{ letterText }}
          </p>
        </article>

        <section class="summary">
          <h3>입력 정보 요약</h3>
          <ul>
            <li>세입자명: {{ tenantName }}</li>
            <li>주소: {{ address }}</li>
            <li>미납 개월수: {{ monthsArrears }}개월</li>
            <li>계좌번호: {{ accountNumber }}</li>
          </ul>
        </section>

        <div class="actions">
          <button
            type="button"
            class="btn btn-primary"
            @click="prevStep"
          >
            이전
          </button>
          <button
            type="button"
            class="btn btn-primary"
            @click="step += 1"
          >
            고지서 확인 · 다음
          </button>
        </div>
      </div>

      <!-- 3단계: 내용증명 PDF 생성 -->
      <div
        v-if="showStep(3)"
        class="card"
      >
        <h2 class="step-title-large">
          {{ STEPS[2].title }}
        </h2>
        <p class="step-subtitle-large">
          {{ STEPS[2].subtitle }}
        </p>

        <p class="intro">
          입력하신 정보를 바탕으로 <strong>법령 조항이 자동으로 들어간</strong> 내용증명을 만듭니다.
          아래 미리보기를 확인한 뒤 PDF로 내려받으세요.
        </p>

        <article
          v-if="notice"
          class="letter"
        >
          <header class="letter-header">
            <p class="letter-title">
              {{ notice.title }}
            </p>
            <p class="letter-subtitle">
              {{ notice.subtitle }}
            </p>
            <p class="letter-date">
              {{ notice.issueDateText }} · 문서번호 {{ notice.documentNumber }}
            </p>
          </header>
          <section class="letter-body">
            <p class="letter-box">
              <span class="label">수신 (임차인)</span>
              <span class="value">{{ notice.tenant.name }} — {{ notice.tenant.address }}</span>
            </p>
            <p class="letter-box">
              <span class="label">발신 (임대인)</span>
              <span class="value">{{ notice.landlord.name }}<template v-if="notice.landlord.phone"> ({{ notice.landlord.phone }})</template></span>
            </p>
            <p class="letter-box">
              <span class="label">미납 기간</span>
              <span class="value">{{ notice.months }}개월 · {{ notice.arrears.severity }}</span>
            </p>
            <p class="letter-box">
              <span class="label">연체 요건</span>
              <span class="value">{{ notice.arrears.lawName }} {{ notice.arrears.thresholdText }} — {{ notice.arrears.met ? '요건 충족 (해지·갱신거절 가능)' : '요건 미달 (' + notice.arrears.shortage + '개월 부족)' }}</span>
            </p>
            <p class="letter-box">
              <span class="label">계좌번호</span>
              <span class="value">{{ notice.accountNumber || accountNumber }}</span>
            </p>

            <ol class="notice-paragraphs">
              <li
                v-for="(fact, index) in notice.facts"
                :key="'fact-' + index"
              >
                {{ fact }}
              </li>
            </ol>

            <h4 class="letter-section-title">
              법령 근거
            </h4>
            <ul class="legal-basis">
              <li
                v-for="(basis, index) in notice.legalBasis"
                :key="'basis-' + index"
              >
                {{ basis }}
              </li>
            </ul>

            <h4 class="letter-section-title">
              요구 사항
            </h4>
            <p class="letter-body-text">
              {{ notice.demandIntro }}
            </p>
            <ol class="notice-paragraphs">
              <li
                v-for="(demand, index) in notice.demands"
                :key="'demand-' + index"
              >
                {{ demand }}
              </li>
            </ol>

            <p class="letter-body-text">
              {{ notice.warning }}
            </p>

            <h4 class="letter-section-title">
              이행이 없을 경우의 법적 절차
            </h4>
            <ol class="notice-paragraphs">
              <li
                v-for="remedy in notice.remedies"
                :key="'remedy-' + remedy.step"
              >
                <strong>{{ remedy.title }}</strong> — {{ remedy.detail }}
              </li>
            </ol>

            <p class="letter-body-text">
              {{ notice.closing }}
            </p>

            <p class="letter-signature">
              {{ notice.issueDateText }} · 임대인 {{ notice.landlord.name }} (인)
            </p>
            <p class="letter-disclaimer">
              {{ notice.disclaimer }}
            </p>
          </section>
        </article>

        <p
          v-if="pdfMessage"
          class="pdf-message"
        >
          {{ pdfMessage }}
        </p>
        <p
          v-if="pdfError"
          class="error"
        >
          {{ pdfError }}
        </p>

        <div class="actions">
          <button
            type="button"
            class="btn btn-primary"
            @click="prevStep"
          >
            이전
          </button>
          <button
            type="button"
            class="btn btn-download"
            :disabled="pdfBusy"
            @click="downloadPdf"
          >
            {{ pdfBusy ? 'PDF 생성 중…' : '📥 내용증명 PDF 다운로드' }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onclick="window.print()"
          >
            인쇄 / PDF 저장
          </button>
          <button
            type="button"
            class="btn btn-primary"
            @click="step += 1"
          >
            법적 절차 연결
          </button>
        </div>
      </div>

      <!-- 4단계: 명도소송/지급명령 연결 -->
      <div
        v-if="showStep(4)"
        class="card"
      >
        <h2 class="step-title-large">
          {{ STEPS[3].title }}
        </h2>
        <p class="step-subtitle-large">
          {{ STEPS[3].subtitle }}
        </p>

        <p class="intro">
          이제부터는 실제 법적 절차를 연결하는 단계입니다. 아래 절차를 순서대로 진행할 수 있습니다.
        </p>

        <ol class="procedure">
          <li class="procedure-step">
            <span class="procedure-number">1</span>
            <div>
              <strong>내용증명 발송</strong>
              <p>작성된 내용증명을 등기우편으로 발송하여 해지 및 반환 의사를 공식적으로 통지합니다.</p>
            </div>
          </li>
          <li class="procedure-step">
            <span class="procedure-number">2</span>
            <div>
              <strong>지급명령 신청</strong>
              <p>임차인의 주소지를 관할하는 법원에 지급명령을 신청하여 신속한 채권 회수를 시도합니다.</p>
            </div>
          </li>
          <li class="procedure-step">
            <span class="procedure-number">3</span>
            <div>
              <strong>명도소송 제기</strong>
              <p>지급명령이 기각되거나 응하지 않을 경우, 명도소송(소유권 기반 철거·인도 청구)을 제기합니다.</p>
            </div>
          </li>
          <li class="procedure-step">
            <span class="procedure-number">4</span>
            <div>
              <strong>강제 집행</strong>
              <p>승소 판결 및 집행문 부여 후, 법원 집행관을 통해 부동산의 인도를 강제 집행합니다.</p>
            </div>
          </li>
        </ol>

        <div class="next-step-message">
          <p>📌 다음 조치를 진행할 준비가 되셨나요?</p>
          <p>1~4단계를 처음부터 다시 입력하려면 아래 <strong>새로 시작</strong> 버튼을 누르세요.</p>
        </div>

        <div class="actions">
          <button
            type="button"
            class="btn btn-primary"
            @click="resetForm"
          >
            새로 시작
          </button>
        </div>
      </div>
    </main>

    <footer class="app-footer">
      <p>P-0660 임대관리 MVP · 4단계 입력 폼</p>
      <p>본 화면은 입력 안내 목적의 예시 화면이며, 실제 법적 조치는 자격 있는 법률 전문가의 자문을 받아야 합니다.</p>
    </footer>
  </div>
</template>

<style scoped>
.app {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
  color: #1f2933;
  background: #f6f7f9;
  min-height: 100vh;
}

.app-header {
  text-align: center;
  margin-bottom: 24px;
}

.app-header h1 {
  font-size: 1.75rem;
  margin: 0 0 6px;
  color: #0f172a;
}

.subtitle {
  margin: 0;
  color: #475569;
  font-size: 0.95rem;
}

/* 단계 진행 표시기 */
.progress-section {
  margin-bottom: 28px;
}

.progress-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 999px;
  transition: width 0.35s ease;
}

.step-list {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 16px 0 0;
  padding: 0;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 12px 8px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  transition: background 0.2s, border-color 0.2s;
}

.step-item.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.step-item.done {
  border-color: #94a3b8;
  color: #64748b;
}

.step-item.active .step-number {
  background: #3b82f6;
  color: #ffffff;
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  transition: background 0.2s, color 0.2s;
}

.step-item.active .step-number {
  background: #3b82f6;
  color: #ffffff;
}

.step-label {
  margin-top: 6px;
}

.step-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
}

.step-subtitle {
  font-size: 0.7rem;
  color: #94a3b8;
  margin-top: 2px;
}

/* 본문 */
.content {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  padding: 24px;
}

.step-title-large {
  font-size: 1.3rem;
  color: #0f172a;
  margin: 0 0 4px;
}

.step-subtitle-large {
  color: #64748b;
  margin: 0 0 20px;
}

.intro {
  color: #475569;
  margin: 0 0 16px;
}

/* 폼 */
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
}

.field label {
  font-size: 0.9rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 6px;
}

.field input {
  padding: 12px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 1rem;
  font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
  transition: border-color 0.2s;
}

.field input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.hint {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 4px;
}

.error {
  font-size: 0.8rem;
  color: #b91c1c;
  margin-top: 4px;
}

/* 알림 / 편지 */
.notice,
.letter {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #3b82f6;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.notice-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 10px;
}

.notice-body {
  white-space: pre-line;
  line-height: 1.7;
  font-size: 0.95rem;
}

.letter-body {
  line-height: 1.7;
  font-size: 0.95rem;
}

.letter-header {
  text-align: center;
  margin-bottom: 16px;
}

.letter-title {
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 2px;
  color: #0f172a;
}

.letter-date {
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 6px;
}

.letter-body {
  text-align: justify;
}

.letter-box {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #e2e8f0;
}

.letter-box:last-of-type {
  border-bottom: none;
}

.label {
  font-weight: 700;
  color: #475569;
  min-width: 130px;
}

.value {
  flex: 1;
}

.procedure {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.procedure-step {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.procedure-number {
  flex: 0 0 32px;
  height: 32px;
  border-radius: 50%;
  background: #3b82f6;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.next-step-message {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 14px;
  font-size: 0.9rem;
  color: #14532d;
  margin: 16px 0;
}

.next-step-message p {
  margin: 4px 0;
}

/* 버튼 */
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.btn {
  padding: 12px 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s, transform 0.05s;
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: #3b82f6;
  color: #ffffff;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #e2e8f0;
  color: #1f2933;
}

.btn-secondary:hover {
  background: #cbd5e1;
}

/* 푸터 */
.app-footer {
  margin-top: 28px;
  text-align: center;
  font-size: 0.78rem;
  color: #94a3b8;
  line-height: 1.6;
}

.field select {
  padding: 12px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 1rem;
  font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
  background: #ffffff;
  transition: border-color 0.2s;
}

.field select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.letter-subtitle {
  font-size: 0.9rem;
  color: #475569;
  margin-top: 4px;
}

.letter-section-title {
  margin: 18px 0 8px;
  font-size: 0.95rem;
  color: #0f172a;
}

.notice-paragraphs,
.legal-basis {
  margin: 0;
  padding-left: 20px;
  line-height: 1.75;
  font-size: 0.92rem;
}

.notice-paragraphs li,
.legal-basis li {
  margin-bottom: 6px;
}

.letter-body-text {
  margin: 12px 0;
  line-height: 1.75;
  font-size: 0.92rem;
}

.letter-signature {
  margin-top: 20px;
  text-align: right;
  font-weight: 700;
}

.letter-disclaimer {
  margin-top: 12px;
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.5;
}

.pdf-message {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  font-size: 0.9rem;
}

.btn-download {
  background: #059669;
  color: #ffffff;
}

.btn-download:hover:not(:disabled) {
  background: #047857;
}

.btn-download:disabled {
  opacity: 0.6;
  cursor: progress;
}

@media (max-width: 600px) {
  .step-list {
    grid-template-columns: repeat(2, 1fr);
  }

  .content {
    padding: 16px;
  }

  .label {
    min-width: 100px;
  }
}
</style>
