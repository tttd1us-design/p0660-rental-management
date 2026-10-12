import { beforeEach, describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import RentalNoticeForm from '../src/components/RentalNoticeForm.vue';

// PDF 생성기는 브라우저에서 폰트를 내려받아 동작하므로, 폼 테스트에서는 호출만 확인한다.
vi.mock('../src/lib/noticePdf.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadNoticePdf: vi.fn() };
});

const { downloadNoticePdf } = await import('../src/lib/noticePdf.js');

const activeStep = (wrapper) => wrapper.find('.step-item.active .step-title').text();
const cardTitle = (wrapper) => wrapper.find('.step-title-large').text();
// jsdom에서는 submit 버튼 클릭만으로 form의 submit 이벤트가 발생하지 않으므로
// form 엘리먼트에 직접 submit 이벤트를 보낸다.
const submitForm = (wrapper) => wrapper.find('form').trigger('submit');

const clickButton = async (wrapper, label) => {
  const button = wrapper.findAll('button').find((node) => node.text().includes(label));
  expect(button, `${label} 버튼을 찾지 못했습니다`).toBeTruthy();
  await button.trigger('click');
};

/** 1단계 입력 → 2단계 고지서 → 3단계 내용증명까지 진행한다. */
const goToNoticeStep = async (wrapper, overrides = {}) => {
  await wrapper.find('#tenantName').setValue(overrides.tenantName ?? '홍길동');
  await wrapper.find('#address').setValue(overrides.address ?? '경기도 안양시 동안구 평촌대로 214');
  await wrapper.find('#monthsArrears').setValue(overrides.monthsArrears ?? '3');
  await wrapper.find('#accountNumber').setValue(overrides.accountNumber ?? '123-456-7890123');
  if (overrides.leaseType) {
    await wrapper.find('#leaseType').setValue(overrides.leaseType);
  }
  if (overrides.landlordName) {
    await wrapper.find('#landlordName').setValue(overrides.landlordName);
  }
  await submitForm(wrapper);
  await clickButton(wrapper, '고지서 확인 · 다음');
};

describe('RentalNoticeForm 4단계 입력 폼', () => {
  it('초기 상태: 1단계가 활성화되고 4개 입력 필드가 비어 있다', () => {
    const wrapper = mount(RentalNoticeForm);

    expect(wrapper.find('#tenantName').exists()).toBe(true);
    expect(wrapper.find('#address').exists()).toBe(true);
    expect(wrapper.find('#monthsArrears').exists()).toBe(true);
    expect(wrapper.find('#accountNumber').exists()).toBe(true);

    expect(wrapper.find('#tenantName').element.value).toBe('');
    expect(wrapper.find('#address').element.value).toBe('');
    expect(wrapper.find('#monthsArrears').element.value).toBe('');
    expect(wrapper.find('#accountNumber').element.value).toBe('');

    expect(activeStep(wrapper)).toBe('미납 감지');
    expect(cardTitle(wrapper)).toBe('미납 감지');
  });

  it('4단계 진행 표시기가 미납 감지·필수 고지·내용증명·법적 절차를 모두 보여준다', () => {
    const wrapper = mount(RentalNoticeForm);
    const steps = wrapper.findAll('.step-item .step-title').map((n) => n.text());

    expect(steps).toEqual(['미납 감지', '부드러운 독촉', '법적 경고', '법적 절차']);
    expect(wrapper.text()).toContain('D+1');
    expect(wrapper.text()).toContain('내용증명');
    expect(wrapper.text()).toContain('명도소송');
  });

  it('미입력 상태로 제출하면 1단계에 머무르며 오류 메시지가 표시된다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await submitForm(wrapper);

    expect(activeStep(wrapper)).toBe('미납 감지');
    expect(cardTitle(wrapper)).toBe('미납 감지');
    expect(wrapper.text()).toContain('입력해 주세요');
  });

  it('모든 필드를 입력하고 제출하면 2단계로 진행하며 고지서에 입력값이 반영된다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await wrapper.find('#tenantName').setValue('홍길동');
    await wrapper.find('#address').setValue('경기도 안양시 동안구 평촌대로 214');
    await wrapper.find('#monthsArrears').setValue('3');
    await wrapper.find('#accountNumber').setValue('123-456-7890123');
    await submitForm(wrapper);

    expect(activeStep(wrapper)).toBe('부드러운 독촉');
    expect(cardTitle(wrapper)).toBe('부드러운 독촉');
    expect(wrapper.text()).toContain('홍길동');
    expect(wrapper.text()).toContain('3개월');
    expect(wrapper.text()).toContain('123-456-7890123');
  });

  it('계좌번호가 9자리 미만이면 검증에 실패하고 1단계에 머무른다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await wrapper.find('#tenantName').setValue('홍길동');
    await wrapper.find('#address').setValue('경기도 안양시 동안구 평촌대로 214');
    await wrapper.find('#monthsArrears').setValue('3');
    await wrapper.find('#accountNumber').setValue('1234');
    await submitForm(wrapper);

    expect(cardTitle(wrapper)).toBe('미납 감지');
    expect(wrapper.text()).toContain('자리 이상이어야');
  });
});

describe('RentalNoticeForm — 임대차 유형 선택', () => {
  it('주택/상가 선택 상자가 있고 기본값은 주택이다', () => {
    const wrapper = mount(RentalNoticeForm);
    const select = wrapper.find('#leaseType');

    expect(select.exists()).toBe(true);
    expect(select.element.value).toBe('housing');
    expect(select.findAll('option').map((o) => o.element.value)).toEqual(['housing', 'commercial']);
  });

  it('임대인 정보는 선택 입력이며 비워 둘 수 있다', () => {
    const wrapper = mount(RentalNoticeForm);

    expect(wrapper.find('#landlordName').exists()).toBe(true);
    expect(wrapper.find('#landlordPhone').exists()).toBe(true);
    expect(wrapper.find('#landlordName').element.value).toBe('');
  });
});

describe('RentalNoticeForm — 3단계 내용증명 자동 생성', () => {
  it('법령 조항과 문서번호가 들어간 내용증명 미리보기를 만든다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await goToNoticeStep(wrapper);

    expect(cardTitle(wrapper)).toBe('법적 경고');
    expect(wrapper.text()).toContain('내 용 증 명');
    expect(wrapper.text()).toContain('수신 (임차인)');
    expect(wrapper.text()).toContain('발신 (임대인)');
    expect(wrapper.text()).toContain('「민법」 제640조');
    expect(wrapper.text()).toContain('「주택임대차보호법」 제6조의3 제1항 제1호');
    expect(wrapper.text()).toContain('법령 근거');
    expect(wrapper.text()).toContain('요구 사항');
    expect(wrapper.text()).toContain('문서번호 HJ-');
    expect(wrapper.text()).toContain('홍길동');
  });

  it('임대인명을 입력하면 발신인에 그대로 반영된다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await goToNoticeStep(wrapper, { landlordName: '김임대' });

    const issuer = wrapper.findAll('.letter-box').find((n) => n.text().includes('발신'));
    expect(issuer.text()).toContain('김임대');
  });

  it('임대인명을 비우면 "임대인"으로 표기한다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await goToNoticeStep(wrapper);

    const issuer = wrapper.findAll('.letter-box').find((n) => n.text().includes('발신'));
    expect(issuer.text()).toContain('임대인');
  });

  it('상가를 선택하면 상가건물 임대차보호법 조항으로 바뀐다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await goToNoticeStep(wrapper, { leaseType: 'commercial', monthsArrears: '3' });

    expect(wrapper.text()).toContain('상가건물 임대차');
    expect(wrapper.text()).toContain('「상가건물 임대차보호법」 제10조의8');
    expect(wrapper.text()).toContain('문서번호 SC-');
    expect(wrapper.text()).not.toContain('제6조의3 제1항 제1호');
  });

  it('연체 개월수가 기준에 못 미치면 요건 미달로 표시한다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await goToNoticeStep(wrapper, { monthsArrears: '1' });

    expect(wrapper.text()).toContain('요건 미달');
    expect(wrapper.text()).toContain('1개월 부족');
  });

  it('면책 문구를 함께 보여준다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await goToNoticeStep(wrapper);

    expect(wrapper.text()).toContain('변호사');
    expect(wrapper.text()).toContain('자동 생성한 초안');
  });
});

describe('RentalNoticeForm — 내용증명 PDF 내려받기', () => {
  beforeEach(() => {
    downloadNoticePdf.mockReset();
    downloadNoticePdf.mockResolvedValue({
      fileName: '내용증명_주택임대차_홍길동_20261012.pdf',
    });
  });

  it('다운로드 버튼을 누르면 입력값으로 PDF 생성을 요청하고 안내 문구를 보여준다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await goToNoticeStep(wrapper, { landlordName: '김임대' });

    const downloadButton = wrapper.findAll('button').find((n) => n.text().includes('내용증명 PDF 다운로드'));
    expect(downloadButton).toBeTruthy();
    await downloadButton.trigger('click');
    await flushPromises();

    expect(downloadNoticePdf).toHaveBeenCalledTimes(1);
    expect(downloadNoticePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantName: '홍길동',
        address: '경기도 안양시 동안구 평촌대로 214',
        monthsArrears: '3',
        accountNumber: '123-456-7890123',
        leaseType: 'housing',
        landlordName: '김임대',
      }),
    );
    expect(wrapper.text()).toContain('내용증명 PDF를 저장했습니다');
    expect(wrapper.text()).toContain('내용증명_주택임대차_홍길동_20261012.pdf');
  });

  it('PDF 생성이 실패하면 오류 문구를 보여준다', async () => {
    downloadNoticePdf.mockRejectedValue(new Error('폰트를 불러오지 못했습니다'));

    const wrapper = mount(RentalNoticeForm);
    await goToNoticeStep(wrapper);

    await clickButton(wrapper, '내용증명 PDF 다운로드');
    await flushPromises();

    expect(wrapper.text()).toContain('PDF 생성에 실패했습니다');
    expect(wrapper.text()).toContain('폰트를 불러오지 못했습니다');
  });

  it('새로 시작하면 이전 PDF 안내 문구가 지워진다', async () => {
    const wrapper = mount(RentalNoticeForm);
    await goToNoticeStep(wrapper);

    await clickButton(wrapper, '내용증명 PDF 다운로드');
    await flushPromises();
    expect(wrapper.text()).toContain('내용증명 PDF를 저장했습니다');

    await clickButton(wrapper, '법적 절차 연결');
    await clickButton(wrapper, '새로 시작');

    expect(wrapper.text()).not.toContain('내용증명 PDF를 저장했습니다');
    expect(wrapper.find('#leaseType').element.value).toBe('housing');
    expect(wrapper.find('#landlordName').element.value).toBe('');
  });
});
