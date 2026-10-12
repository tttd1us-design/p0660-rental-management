import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    // C:\AI_산출물\... 과 D:\10조북스\... 는 같은 폴더를 가리키는 '연결(정션)'이다.
    // Vite 가 심볼릭 링크를 실제 경로로 바꾸면(realpath) 테스트 파일을 찾지 못하므로,
    // 링크 경로를 그대로 유지해 어느 쪽 경로에서 실행해도 동작하게 한다.
    preserveSymlinks: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.spec.js'],
    // 내용증명 PDF 는 2MB 한글 폰트를 심어 만들기 때문에 기본 5초로는 부족하다.
    testTimeout: 30000,
  },
});
