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
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
