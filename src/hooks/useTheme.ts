import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

// 스토어 theme 값을 <html> 의 .dark 클래스 + localStorage 에 동기화한다.
// index.html 의 인라인 스크립트가 첫 페인트 전 .dark 를 미리 적용해 깜빡임을 막고,
// 이 훅은 이후 토글 변화를 반영한다.
export function useTheme(): void {
  const theme = useGameStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('ray-theme', theme);
    } catch { /* localStorage 접근 실패 무시 */ }
  }, [theme]);
}
