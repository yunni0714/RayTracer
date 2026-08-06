import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

// 스토어 settings 를 <html> 의 data-* 속성에 동기화한다 (useTheme 의 .dark 와 대칭).
// CSS 는 html[data-pastel="on"] 셀렉터로만 반응하므로 카드 컴포넌트는 손대지 않는다.
export function useUserSettings(): void {
  const pastelCards = useGameStore((s) => s.settings.pastelCards);

  useEffect(() => {
    document.documentElement.dataset.pastel = pastelCards ? 'on' : 'off';
  }, [pastelCards]);
}
