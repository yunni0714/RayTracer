import { defineConfig } from 'vitest/config';

// e2e(Playwright)는 npm run test:e2e 로 분리 — vitest는 순수 단위테스트만 본다.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
