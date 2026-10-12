import { describe, it, expect } from 'vitest';
import {
  LEASE_TYPES,
  LEGAL_CLAUSES,
  DEMAND_DAYS,
  formatCitation,
  text,
  normalizeMonths,
  withThousands,
  formatWon,
  formatKoreanDate,
  getLeaseConfig,
  inferLeaseType,
  evaluateArrears,
  selectApplicableProvisions,
  buildLegalBasisLines,
  buildNoticeContent,
  generateLegalNoticeText,
} from '../src/lib/legalEngine.js';

/** 테스트용 고정 입력값 — 날짜를 고정해야 문서번호가 결정적(deterministic)이 된다. */
const HOUSING = {
  tenantName: '홍길동',
  address: '서울특별시 강남구 테헤란로 123, 101동 1001호',
  monthsArrears: '3',
  accountNumber: '110-123-456789',
  leaseType: 'housing',
  landlordName: '김임대',
  issueDate: '2026-10-12',
};

const COMMERCIAL = {
  ...HOUSING,
  address: '서울특별시 마포구 합정동 45, 1층 상가',
  leaseType: 'commercial',
};

describe('legalEngine — 문자열·숫자 유틸리티', () => {
  it('text() 는 null/undefined 를 안전하게 빈 문자열로 만든다', () => {
    expect(text(null)).toBe('');
    expect(text(undefined)).toBe('');
    expect(text('  홍길동  ')).toBe('홍길동');
  });

  it('normalizeMonths() 는 "3개월"·3 을 3으로, 잘못된 값은 0으로 만든다', () => {
    expect(normalizeMonths('3개월')).toBe(3);
    expect(normalizeMonths('3')).toBe(3);
    expect(normalizeMonths(3)).toBe(3);
    expect(normalizeMonths('')).toBe(0);
    expect(normalizeMonths('abc')).toBe(0);
    expect(normalizeMonths(-2)).toBe(0);
    expect(normalizeMonths(0)).toBe(0);
  });

  it('withThousands()/formatWon() 은 금액을 결정적으로 표기한다', () => {
    expect(withThousands(1234567)).toBe('1,234,567');
    expect(withThousands('1234567')).toBe('1,234,567');
    expect(withThousands(0)).toBe('');
    expect(formatWon(1500000)).toBe('1,500,000원');
    expect(formatWon(0)).toBe('');
    expect(formatWon('')).toBe('');
  });

  it('formatKoreanDate() 는 "2026년 10월 12일" 형식으로 만든다', () => {
    expect(formatKoreanDate(new Date(2026, 9, 12))).toBe('2026년 10월 12일');
    expect(formatKoreanDate('2026-10-01')).toBe('2026년 10월 1일');
  });

  it('formatCitation() 은 「법령」 조(제목) 형식으로 인용한다', () => {
    const provision = { law: '민법', article: '제640조', title: '차임연체와 해지' };
    expect(formatCitation(provision)).toBe('「민법」 제640조(차임연체와 해지)');
  });
});

describe('legalEngine — 법령 조항 데이터', () => {
  it('주택은 2기, 상가는 3기 연체를 기준으로 삼는다', () => {
    expect(LEGAL_CLAUSES[LEASE_TYPES.HOUSING].threshold).toBe(2);
    expect(LEGAL_CLAUSES[LEASE_TYPES.COMMERCIAL].threshold).toBe(3);
  });

  it('주택 조항은 민법 제640조·주택임대차보호법 제6조의3을 포함한다', () => {
    const articles = LEGAL_CLAUSES[LEASE_TYPES.HOUSING].provisions.map((p) => p.article);
    expect(articles).toContain('제640조');
    expect(articles).toContain('제6조 제3항');
    expect(articles).toContain('제6조의3 제1항 제1호');
  });

  it('상가 조항은 상가건물 임대차보호법 제10조의8·제10조 제1항 제1호를 포함한다', () => {
    const articles = LEGAL_CLAUSES[LEASE_TYPES.COMMERCIAL].provisions.map((p) => p.article);
    expect(articles).toContain('제10조의8');
    expect(articles).toContain('제10조 제1항 제1호');
  });

  it('getLeaseConfig() 는 알 수 없는 유형이면 주택으로 되돌린다', () => {
    expect(getLeaseConfig('없는유형').key).toBe(LEASE_TYPES.HOUSING);
    expect(getLeaseConfig('commercial').key).toBe(LEASE_TYPES.COMMERCIAL);
  });

  it('inferLeaseType() 은 명시값과 용도 단서로 유형을 추정한다', () => {
    expect(inferLeaseType({ leaseType: 'commercial' })).toBe(LEASE_TYPES.COMMERCIAL);
    expect(inferLeaseType({ leaseType: '상가' })).toBe(LEASE_TYPES.COMMERCIAL);
    expect(inferLeaseType({ usage: '1층 점포' })).toBe(LEASE_TYPES.COMMERCIAL);
    expect(inferLeaseType({ usage: '아파트 101동' })).toBe(LEASE_TYPES.HOUSING);
    expect(inferLeaseType({})).toBe(LEASE_TYPES.HOUSING);
  });
});

describe('legalEngine — 연체 상태 평가', () => {
  it('주택 2기는 해지·갱신거절 요건을 충족한다', () => {
    const result = evaluateArrears(2, LEASE_TYPES.HOUSING);
    expect(result.months).toBe(2);
    expect(result.met).toBe(true);
    expect(result.shortage).toBe(0);
    expect(result.canTerminate).toBe(true);
    expect(result.canRefuseRenewal).toBe(true);
    expect(result.lawName).toBe('주택임대차보호법');
    expect(result.severity).toBe('법적 요건 충족');
  });

  it('주택 1기는 요건 미달이다', () => {
    const result = evaluateArrears(1, LEASE_TYPES.HOUSING);
    expect(result.met).toBe(false);
    expect(result.shortage).toBe(1);
    expect(result.canTerminate).toBe(false);
    expect(result.severity).toBe('요건 미달');
  });

  it('상가 2기는 미달, 3기는 충족이다', () => {
    expect(evaluateArrears('2개월', LEASE_TYPES.COMMERCIAL).met).toBe(false);
    expect(evaluateArrears('2개월', LEASE_TYPES.COMMERCIAL).shortage).toBe(1);
    expect(evaluateArrears('3개월', LEASE_TYPES.COMMERCIAL).met).toBe(true);
  });

  it('기준의 2배 이상 연체하면 중대 단계로 올린다', () => {
    expect(evaluateArrears(4, LEASE_TYPES.HOUSING).severity).toBe('중대(2배 이상 연체)');
    expect(evaluateArrears(6, LEASE_TYPES.COMMERCIAL).severity).toBe('중대(2배 이상 연체)');
  });

  it('selectApplicableProvisions() 는 모든 조항에 적용 여부를 붙여 돌려준다', () => {
    const met = selectApplicableProvisions(3, LEASE_TYPES.HOUSING);
    expect(met).toHaveLength(3);
    expect(met.every((p) => p.applies)).toBe(true);

    const notMet = selectApplicableProvisions(1, LEASE_TYPES.HOUSING);
    expect(notMet.every((p) => p.applies)).toBe(false);
  });
});

describe('legalEngine — 법령 근거 문장', () => {
  it('요건 충족 시 해당 조항을 모두 인용한다', () => {
    const lines = buildLegalBasisLines(2, LEASE_TYPES.HOUSING);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('「민법」 제640조');
    expect(lines.join(' ')).toContain('「주택임대차보호법」 제6조의3 제1항 제1호');
  });

  it('상가 요건 충족 시 상가 조항을 인용한다', () => {
    const lines = buildLegalBasisLines(5, LEASE_TYPES.COMMERCIAL);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('「상가건물 임대차보호법」 제10조의8');
  });

  it('요건 미달이면 미달 사실과 지급 최고 근거를 안내한다', () => {
    const lines = buildLegalBasisLines(1, LEASE_TYPES.HOUSING);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('미달');
    expect(lines[0]).toContain('1개월 미달');
    expect(lines[1]).toContain('민법');
  });
});

describe('legalEngine — 내용증명 구성 (buildNoticeContent)', () => {
  it('입력값을 반영한 완성 구조를 만든다', () => {
    const notice = buildNoticeContent(HOUSING);

    expect(notice.leaseType).toBe(LEASE_TYPES.HOUSING);
    expect(notice.title).toBe('내 용 증 명');
    expect(notice.subtitle).toContain('주택임대차');
    expect(notice.tenant.name).toBe('홍길동');
    expect(notice.tenant.address).toContain('테헤란로');
    expect(notice.landlord.name).toBe('김임대');
    expect(notice.months).toBe(3);
    expect(notice.arrears.met).toBe(true);
    expect(notice.isLegallyActionable).toBe(true);
    expect(notice.issueDateText).toBe('2026년 10월 12일');
  });

  it('문서번호는 유형코드-발급일-임차인명 규칙을 따른다', () => {
    expect(buildNoticeContent(HOUSING).documentNumber).toBe('HJ-20261012-홍길동');
    expect(buildNoticeContent(COMMERCIAL).documentNumber).toBe('SC-20261012-홍길동');
  });

  it('사실관계·법령근거·요구사항·법적절차가 모두 채워진다', () => {
    const notice = buildNoticeContent(HOUSING);
    expect(notice.facts).toHaveLength(2);
    expect(notice.legalBasis.length).toBeGreaterThan(0);
    expect(notice.demands).toHaveLength(3);
    expect(notice.remedies).toHaveLength(4);
    expect(notice.remedies.map((r) => r.step)).toEqual([1, 2, 3, 4]);
    expect(notice.remedies[1].title).toBe('지급명령 신청');
    expect(notice.demandIntro).toContain(`${DEMAND_DAYS}일 이내`);
    expect(notice.warning).toContain('해지');
    expect(notice.closing).toContain('내용증명 우편');
  });

  it('요건 충족 시 사실관계 문장이 "해당(도달)"로 쓰인다', () => {
    const notice = buildNoticeContent(HOUSING);
    expect(notice.facts[1]).toContain('3개월분의 차임');
    expect(notice.facts[1]).toContain('해당(도달)');
  });

  it('요건 미달이면 경고 문구가 약해진다', () => {
    const notice = buildNoticeContent({ ...HOUSING, monthsArrears: '1' });
    expect(notice.arrears.met).toBe(false);
    expect(notice.isLegallyActionable).toBe(false);
    expect(notice.facts[1]).toContain('미달');
    expect(notice.warning).not.toContain('해지하고');
  });

  it('임차인·임대인 이름이 없으면 기본 표기를 쓴다', () => {
    const notice = buildNoticeContent({ monthsArrears: '3' });
    expect(notice.tenant.name).toBe('임차인');
    expect(notice.landlord.name).toBe('임대인');
  });

  it('계좌번호가 없으면 요구사항에 계좌 안내가 빠진다', () => {
    const withAccount = buildNoticeContent(HOUSING);
    const without = buildNoticeContent({ ...HOUSING, accountNumber: '' });
    expect(withAccount.demands[0]).toContain('입금 계좌');
    expect(without.demands[0]).not.toContain('입금 계좌');
  });

  it('법률 자문이 아님을 밝히는 면책 문구를 포함한다', () => {
    const notice = buildNoticeContent(HOUSING);
    expect(notice.disclaimer).toContain('변호사');
    expect(notice.disclaimer).toContain('자동 생성한 초안');
  });

  it('상가 입력이면 상가 조항이 들어간다', () => {
    const notice = buildNoticeContent(COMMERCIAL);
    expect(notice.leaseType).toBe(LEASE_TYPES.COMMERCIAL);
    expect(notice.subtitle).toContain('상가건물 임대차');
    expect(notice.legalBasis.join(' ')).toContain('제10조의8');
  });
});

describe('legalEngine — 평문 내용증명 (generateLegalNoticeText)', () => {
  it('제목·문서번호·수신·요구사항·종합을 모두 담는다', () => {
    const plain = generateLegalNoticeText(HOUSING);
    expect(plain).toContain('내 용 증 명');
    expect(plain).toContain('문서번호: HJ-20261012-홍길동');
    expect(plain).toContain('수신: 홍길동');
    expect(plain).toContain('[요구 사항]');
    expect(plain).toContain('[종합]');
    expect(plain).toContain('「민법」 제640조');
    expect(plain).toContain('변호사');
  });

  it('요건 미달이면 종합 줄에 부족 개월수를 적는다', () => {
    const plain = generateLegalNoticeText({ ...HOUSING, monthsArrears: '1' });
    expect(plain).toContain('1개월 미달');
  });
});
