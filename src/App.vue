<script setup>
import { ref } from 'vue';
import RentalNoticeForm from './components/RentalNoticeForm.vue';
import Payment from './pages/Payment.vue';

const showPayment = ref(false);
</script>

<template>
  <div id="app">
    <header class="app-header">
      <h1>P-0660 임대관리 MVP</h1>
      <button class="btn ghost" @click="showPayment = true">결제 연동 (9,900원)</button>
    </header>
    <main class="app-main">
      <rental-notice-form v-if="!showPayment" />
      <payment v-else />
    </main>
    <footer class="app-footer">
      <span class="hint">4단계 입력 폼(미납 감지 → 독촉 → 내용증명) + 결제 연동</span>
    </footer>
  </div>
</template>

<style>
body { margin: 0; background: #f6f7f9; font-family: 'Pretendard', 'Malgun Gothic', sans-serif; }
.app-header { background: #1f2937; color: #fff; padding: .75rem 1.5rem; display: flex; align-items: center; justify-content: space-between; }
.app-header h1 { margin: 0; font-size: 1.1rem; }
.app-main { max-width: 640px; margin: 0 auto; padding: 1rem; }
.app-footer { text-align: center; color: #9ca3af; font-size: .8rem; margin-top: 1.5rem; }
.btn { display: inline-block; padding: .5rem .9rem; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: .85rem; }
.btn.ghost { background: transparent; color: #1f2937; }
.btn.ghost:hover { background: #f3f4f6; }
.hint { color: #6b7280; font-size: .8rem; }
</style>
