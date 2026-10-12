/**
 * P-0660 임대관리 — 법령 조항 자동 삽입 엔진 (legalEngine)
 * =======================================================
 *
 * 이 파일이 하는 일
 *  1. 주택임대차보호법 · 상가건물 임대차보호법의 '차임 연체' 관련 조항을 데이터로 정의한다.
 *  2. 입력 폼에서 받은 값(임차인명 · 주소 · 미납 개월수 · 계좌번호 등)을 넣으면
 *     그 사실관계에 맞는 법령 조항과 문구를 자동으로 골라 문장을 만들어 준다.
 *  3. 화면(HTML)에 의존하지 않는 순수 함수만 두었다. (단위 테스트 · 서버 · CLI 어디서든 재사용 가능)
 *
 * 법령 근거 (2026년 10월 기준, 국가법령정보센터 원문 확인)
 *  · 주택(2기 연체 기준)
 *    - 「민법」 제640조(차임연체와 해지): 임차인이 2기 이상의 차임을 지급하지 아니한 때 임대인은 계약을 해지할 수 있다.
 *    - 「주택임대차보호법」 제6조 제3항: 2기의 차임액에 달하도록 연체하면 묵시의 갱신이 인정되지 않는다.
 *    - 「주택임대차보호법」 제6조의3 제1항 제1호: 2기의 차임액에 이르도록 연체한 사실이 있으면 계약갱신요구를 거절할 수 있다.
 *  · 상가(3기 연체 기준)
 *    - 「상가건물 임대차보호법」 제10조의8(차임연체와 해지): 임차인의 차임연체액이 3기의 차임액에 달하는 때 임대인은 계약을 해지할 수 있다.
 *    - 「상가건물 임대차보호법」 제10조 제1항 제1호: 3기의 차임액에 이르도록 연체한 사실이 있으면 계약갱신요구를 거절할 수 있다.
 *
 * ⚠️ 이 엔진은 '문구 자동 생성 도구'이며 법률 자문이 아니다.
 *    실제 발송 전에는 반드시 변호사 등 자격 있는 전문가의 검토를 받아야 한다.
 *
 * 조항을 고치거나 새 임대차 유형을 추가하려면 아래 LEGAL_CLAUSES 한 곳만 수정하면 된다.
 */

/** 임대차 유형 키 */
export const LEASE_TYPES = Object.freeze({
  HOUSING: 'housing',
  COMMERCIAL: 'commercial',
});

/** 미납 차임 지급 최고 기간(일) — 내용증명 본문에 쓰인다. */
export const DEMAND_DAYS = 7;

/**
 * 법령 조항 데이터 (하드코딩 → 이후 설정 파일/DB로 분리 가능)
 * threshold: 계약해지·갱신거절이 가능해지는 연체 '기' 수
 * provisions: 인용할 조항 목록 { law, article, title, text, effect }
 *   effect: 'termination'(해지) | 'renewal-refusal'(갱신거절) | 'implied-renewal'(묵시갱신 배제)
 */
export const LEGAL_CLAUSES = Object.freeze({
  [LEASE_TYPES.HOUSING]: Object.freeze({
    key: LEASE_TYPES.HOUSING,
    label: '주택임대차',
    lawName: '주택임대차보호법',
    threshold: 2,
    thresholdText: '2기의 차임액',
    provisions: Object.freeze([
      Object.freeze({
        law: '민법',
        article: '제640조',
        title: '차임연체와 해지',
        effect: 'termination',
        text: '건물 기타 공작물의 임대차에 있어서 임차인이 2기 이상의 차임을 지급하지 아니한 때에는 임대인은 계약을 해지할 수 있습니다.',
      }),
      Object.freeze({
        law: '주택임대차보호법',
        article: '제6조 제3항',
        title: '묵시의 갱신 배제',
        effect: 'implied-renewal',
        text: '임차인이 2기의 차임액에 달하도록 차임을 연체한 경우에는 묵시의 갱신이 인정되지 아니하여 임대차는 기간의 만료로 종료됩니다.',
      }),
      Object.freeze({
        law: '주택임대차보호법',
        article: '제6조의3 제1항 제1호',
        title: '계약갱신요구의 거절',
        effect: 'renewal-refusal',
        text: '임차인이 2기의 차임액에 해당하는 금액에 이르도록 차임을 연체한 사실이 있는 경우 임대인은 임차인의 계약갱신 요구를 거절할 수 있습니다.',
      }),
    ]),
  }),
  [LEASE_TYPES.COMMERCIAL]: Object.freeze({
    key: LEASE_TYPES.COMMERCIAL,
    label: '상가건물 임대차',
    lawName: '상가건물 임대차보호법',
    threshold: 3,
    thresholdText: '3기의 차임액',
    provisions: Object.freeze([
      Object.freeze({
        law: '상가건물 임대차보호법',
        article: '제10조의8',
        title: '차임연체와 해지',
        effect: 'termination',
        text: '임차인의 차임연체액이 3기의 차임액에 달하는 때에는 임대인은 계약을 해지할 수 있습니다.',
      }),
      Object.freeze({
        law: '상가건물 임대차보호법',
        article: '제10조 제1항 제1호',
        title: '계약갱신요구의 거절',
        effect: 'renewal-refusal',
        text: '임차인이 3기의 차임액에 해당하는 금액에 이르도록 차임을 연체한 사실이 있는 경우 임대인은 임차인의 계약갱신 요구를 거절할 수 있습니다.',
      }),
    ]),
  }),
});

/** 조항을 인용할 때 쓰는 표기: 「주택임대차보호법」 제6조의3 제1항 제1호(계약갱신요구의 거절) */
export function formatCitation(provision) {
  return `「${provision.law}」 ${provision.article}(${provision.title})`;
}

/** 문자열 정규화(trim) — null/undefined 안전 */
export function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/** '3개월', '3', 3 → 3 (음수·소수·문자는 0으로) */
export function normalizeMonths(value) {
  const cleaned = text(value).replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** 1234567 → '1,234,567' (toLocaleString 없이 결정적으로 변환) */
export function withThousands(value) {
  const n = Number(String(value ?? '').replace(/[^\d]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 금액 표기: 1500000 → '1,500,000원' (0/미입력이면 '') */
export function formatWon(value) {
  const formatted = withThousands(value);
  return formatted ? `${formatted}원` : '';
}

/** 날짜 객체로 변환(실패 시 현재 시각) */
export function toDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** 2026년 10월 12일 */
export function formatKoreanDate(value = new Date()) {
  const d = toDate(value);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 임대차 유형 설정 조회(없으면 오류) */
export function getLeaseConfig(leaseType) {
  const key = Object.prototype.hasOwnProperty.call(LEGAL_CLAUSES, leaseType)
    ? leaseType
    : LEASE_TYPES.HOUSING;
  return LEGAL_CLAUSES[key];
}

/**
 * 입력값으로 임대차 유형 추정.
 * - leaseType/usage(용도)에 '상가·상업·사무·점포·영업' 등이 있으면 상가,
 *   '주택·주거·아파트·빌라·오피스텔·원룸' 등이 있으면 주택.
 * - 아무 단서가 없으면 주택(기본값).
 */
export function inferLeaseType(input = {}) {
  const explicit = text(input.leaseType).toLowerCase();
  if (['commercial', '상가', '상업용', '상가건물'].includes(explicit)) return LEASE_TYPES.COMMERCIAL;
  if (['housing', '주택', '주거용', '주택임대차'].includes(explicit)) return LEASE_TYPES.HOUSING;

  const usage = text(input.usage);
  if (/상가|상업|사무|점포|매장|영업|공장|창고/.test(usage)) return LEASE_TYPES.COMMERCIAL;
  if (/주택|주거|아파트|빌라|오피스텔|원룸|전세|월세/.test(usage)) return LEASE_TYPES.HOUSING;

  return LEASE_TYPES.HOUSING;
}

/**
 * 연체 상태 평가.
 * @returns {{leaseType,leaseLabel,lawName,months,threshold,thresholdText,met,shortage,severity,canTerminate,canRefuseRenewal}}
 */
export function evaluateArrears(monthsArrears, leaseType = LEASE_TYPES.HOUSING) {
  const config = getLeaseConfig(leaseType);
  const months = normalizeMonths(monthsArrears);
  const met = months >= config.threshold;

  let severity = '요건 미달';
  if (met) {
    severity = months >= config.threshold * 2 ? '중대(2배 이상 연체)' : '법적 요건 충족';
  }

  return {
    leaseType: config.key,
    leaseLabel: config.label,
    lawName: config.lawName,
    months,
    threshold: config.threshold,
    thresholdText: config.thresholdText,
    met,
    shortage: met ? 0 : config.threshold - months,
    severity,
    canTerminate: met,
    canRefuseRenewal: met,
  };
}

/** 연체 개월수에 맞는 조항 목록(각 조항에 applies 여부 포함) */
export function selectApplicableProvisions(monthsArrears, leaseType = LEASE_TYPES.HOUSING) {
  const config = getLeaseConfig(leaseType);
  const { met } = evaluateArrears(monthsArrears, leaseType);
  return config.provisions.map((provision) => ({ ...provision, applies: met }));
}

/**
 * 내용증명 본문에 넣을 '법령 근거' 문장 배열을 만든다.
 * 요건을 충족하면 해당 조항을 인용하고, 미달이면 미달 사실과 함께 지급 최고 근거를 안내한다.
 */
export function buildLegalBasisLines(monthsArrears, leaseType = LEASE_TYPES.HOUSING) {
  const config = getLeaseConfig(leaseType);
  const evaluation = evaluateArrears(monthsArrears, leaseType);
  const lines = [];

  if (evaluation.met) {
    config.provisions.forEach((provision) => {
      lines.push(`${formatCitation(provision)} — ${provision.text}`);
    });
  } else {
    lines.push(
      `현재 미납 ${evaluation.months}개월은 ${config.label}의 계약해지·갱신거절 요건인 `
      + `${config.thresholdText}에 ${evaluation.shortage}개월 미달합니다.`,
    );
    lines.push(
      '다만 차임 지급 의무는 임대차계약 및 「민법」 제618조·제623조에 따른 것이므로, '
      + '미납 차임의 지급을 최고하고 그 불이행에 대한 법적 조치를 예고할 수 있습니다.',
    );
  }

  return lines;
}

/**
 * 입력 폼 데이터 → 내용증명에 들어갈 문구·구성을 통째로 만들어 준다.
 * (화면에 그대로 그릴 수 있게 섹션별로 나눠서 돌려준다.)
 */
export function buildNoticeContent(input = {}, options = {}) {
  const leaseType = inferLeaseType(input);
  const config = getLeaseConfig(leaseType);

  const evaluation = evaluateArrears(input.monthsArrears, leaseType);
  const months = evaluation.months;

  const tenant = {
    name: text(input.tenantName) || '임차인',
    address: text(input.address) || '(주소 미기재)',
  };
  const landlord = {
    name: text(input.landlordName) || '임대인',
    address: text(input.landlordAddress) || '',
    phone: text(input.landlordPhone) || '',
  };

  const monthlyRent = formatWon(input.monthlyRent);
  const deposit = formatWon(input.deposit);
  const accountNumber = text(input.accountNumber);

  const issueDate = toDate(
    input.issueDate !== undefined ? input.issueDate : options.issueDate,
  );
  const issueDateText = formatKoreanDate(issueDate);

  const legalBasis = buildLegalBasisLines(months, leaseType);

  const facts = [];
  facts.push(
    `본인(임대인)과 귀하(임차인) 사이에 체결된 ${config.label} 계약에 따라, `
    + '본인은 귀하에게 위 임대차 목적물을 인도하여 사용·수익하게 하였습니다.',
  );
  facts.push(
    `그러나 귀하는 정당한 사유 없이 ${months}개월분의 차임을 지급하지 아니하여, `
    + `현재 ${evaluation.thresholdText}${evaluation.met ? '에 해당(도달)하는 연체가 발생' : '에는 미달하는 연체가 발생'}하였습니다.`,
  );

  const demands = [
    `미납 차임 ${months}개월분 전액의 지급${accountNumber ? ` (입금 계좌: ${accountNumber})` : ''}`,
    '임대차 목적물의 원상 반환(명도)',
    '향후 차임의 정상 지급',
  ];

  const demandIntro =
    `이에 본인은 귀하에게 상당한 기간(이 내용증명을 받은 날부터 ${DEMAND_DAYS}일 이내)을 정하여 `
    + '아래 사항의 이행을 최고합니다.';

  const warning = evaluation.met
    ? `만약 위 기간 내에 이행하지 아니할 경우, 본인은 ${config.lawName} 및 「민법」에 따라 `
      + '임대차계약을 해지하고, 내용증명 발송·지급명령 신청·명도소송 제기·강제집행 등 '
      + '법적 절차를 진행할 것임을 통지합니다.'
    : '만약 위 기간 내에 이행하지 아니할 경우, 본인은 부득이 지급명령 신청 등 '
      + '법적 절차를 진행할 수 있음을 통지합니다.';

  const closing =
    '본 문서는 우체국 내용증명 우편으로 발송되며, 그 내용을 우체국이 증명하는 문서입니다. '
    + '귀하의 조속한 이행을 요청합니다.';

  const remedies = [
    { step: 1, title: '내용증명 발송', detail: '작성한 내용증명을 내용증명 우편(등기)으로 발송하여 해지·반환 의사를 공식 통지합니다.' },
    { step: 2, title: '지급명령 신청', detail: '임차인의 주소지 관할 법원에 미납 차임에 대한 지급명령을 신청합니다.' },
    { step: 3, title: '명도소송 제기', detail: '이행이 없으면 임대차 목적물 인도를 구하는 명도소송을 제기합니다.' },
    { step: 4, title: '강제집행', detail: '승소 판결 및 집행문 부여 후 집행관을 통해 인도를 강제집행합니다.' },
  ];

  // 화면 · PDF 가 같은 순서로 그릴 수 있도록 '블록' 형태로도 함께 제공한다.
  const blocks = [
    ...facts.map((line) => ({ type: 'fact', text: line })),
    ...legalBasis.map((line) => ({ type: 'legal', text: line })),
    { type: 'demand-intro', text: demandIntro },
    { type: 'demand-list', items: demands },
    { type: 'warning', text: warning },
    { type: 'closing', text: closing },
  ];

  const paragraphs = blocks
    .filter((block) => typeof block.text === 'string')
    .map((block) => block.text)
    .filter((line) => line !== demandIntro);

  const documentNumber = buildDocumentNumber(leaseType, issueDate, tenant.name);

  return {
    leaseType,
    leaseLabel: config.label,
    lawName: config.lawName,
    title: '내 용 증 명',
    subtitle: `${config.label} 차임 연체 및 계약해지 통지`,
    documentNumber,
    issueDate,
    issueDateText,
    tenant,
    landlord,
    months,
    accountNumber,
    rent: { monthlyRent, deposit },
    arrears: evaluation,
    facts,
    legalBasis,
    demands,
    demandIntro,
    warning,
    closing,
    remedies,
    blocks,
    paragraphs,
    disclaimer:
      '본 문서는 P-0660 임대관리 서비스가 입력값을 바탕으로 자동 생성한 초안이며, '
      + '실제 발송 전에는 반드시 변호사 등 자격 있는 법률 전문가의 검토를 받아야 합니다.',
    isLegallyActionable: evaluation.met,
  };
}

/** 문서번호: HJ-20261012-홍길동 → 유형코드 + 발급일 + 임차인명 */
function buildDocumentNumber(leaseType, issueDate, tenantName) {
  const prefix = leaseType === LEASE_TYPES.COMMERCIAL ? 'SC' : 'HJ';
  const d = toDate(issueDate);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const name = text(tenantName).replace(/\s+/g, '').slice(0, 10) || '임차인';
  return `${prefix}-${yyyy}${mm}${dd}-${name}`;
}

/**
 * 내용증명 전체를 하나의 평문 문자열로 만든다.
 * (미리보기·테스트·PDF 본문 어디에나 쓸 수 있는 '완성 문구'.)
 */
export function generateLegalNoticeText(input = {}, options = {}) {
  const notice = buildNoticeContent(input, options);
  const lines = [];

  lines.push(notice.title);
  lines.push(`문서번호: ${notice.documentNumber}`);
  lines.push(`작성일: ${notice.issueDateText}`);
  lines.push('');
  lines.push(`수신: ${notice.tenant.name} (${notice.tenant.address})`);
  lines.push(`발신: ${notice.landlord.name}${notice.landlord.address ? ` (${notice.landlord.address})` : ''}`);
  lines.push(`제목: ${notice.subtitle}`);
  lines.push('');
  notice.paragraphs.forEach((paragraph, index) => {
    lines.push(`${index + 1}. ${paragraph}`);
  });
  lines.push('');
  lines.push('[요구 사항]');
  notice.demands.forEach((demand, index) => {
    lines.push(`  ${index + 1}) ${demand}`);
  });
  lines.push('');
  lines.push(`[종합] ${notice.arrears.met
    ? `${notice.arrears.thresholdText} 연체 요건이 충족되어 계약해지·갱신거절이 가능한 상태입니다.`
    : `${notice.arrears.thresholdText} 요건에는 ${notice.arrears.shortage}개월 미달이나, 지급 최고 및 법적 조치 예고는 가능합니다.`}`);
  lines.push('');
  lines.push(notice.disclaimer);

  return lines.join('\n');
}
