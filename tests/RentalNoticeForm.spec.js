import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RentalNoticeForm from '../src/components/RentalNoticeForm.vue';

const activeStep = (wrapper) => wrapper.find('.step-item.active .step-title').text();
const cardTitle = (wrapper) => wrapper.find('.step-title-large').text();
// jsdom에서는 submit 버튼 클릭만으로 form의 submit 이벤트가 발생하지 않으므로
// form 엘리먼트에 직접 submit 이벤트를 보낸다.
const submitForm = (wrapper) => wrapper.find('form').trigger('submit');

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

    expect(steps).toEqual(['미납 감지', '필수 고지', '내용증명', '법적 절차']);
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

    expect(activeStep(wrapper)).toBe('필수 고지');
    expect(cardTitle(wrapper)).toBe('필수 고지');
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
