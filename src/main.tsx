import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { useGameStore } from './store/gameStore';
import './styles/global.css';

// Playwright e2e 테스트에서 스토어를 직접 조작할 수 있도록 DEV 환경에서만 노출
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>)['__rayStore'] = useGameStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* basename 필수 — 없으면 GH Pages(/RayTracer/)에서 라우트 이동 시
        베이스 밖 URL 이 되어 새로고침에 GitHub 기본 404 로 튕긴다 */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
