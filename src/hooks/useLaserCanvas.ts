import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { simulateLaser, clearLaser, setupCanvas } from '../lib/laserEngine';
import { getLastRotationEvent, ROTATION_ANIM_MS } from '../lib/pieceActions';

// 회전 애니메이션이 진행 중이면 레이저 갱신을 종료 시점까지 미룬다.
// 연속 회전 시 effect 재실행 → cleanup 으로 타이머가 갱신돼 마지막만 그린다.
function rotationAnimRemaining(): number {
  const ev = getLastRotationEvent();
  if (!ev) return 0;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  return Math.max(0, ev.ts + ROTATION_ANIM_MS - Date.now());
}

export function useLaserCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const isLaserOn = useGameStore(s => s.isLaserOn);
  const mapData = useGameStore(s => s.mapData);
  const theme = useGameStore(s => s.theme); // 레이저 색 토큰이 테마를 따라가므로 재그리기 필요

  // 컨테이너 유동 크기: 리사이즈 시 백킹스토어를 dpr 배율로 재설정하고 다시 그린다
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      ctxRef.current = setupCanvas(canvas);
      const s = useGameStore.getState();
      if (s.isLaserOn) simulateLaser(ctxRef.current, canvas, s.mapData);
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // isLaserOn / mapData / theme 변경 시마다 레이저 재계산
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    if (!isLaserOn) {
      clearLaser(ctx, canvas);
      return;
    }

    const remaining = rotationAnimRemaining();
    if (remaining === 0) {
      simulateLaser(ctx, canvas, mapData);
      return;
    }
    // +20ms: 애니메이션 종료 프레임과 레이저 갱신이 겹쳐 보이지 않게 약간 여유
    const timer = window.setTimeout(() => simulateLaser(ctx, canvas, mapData), remaining + 20);
    return () => window.clearTimeout(timer);
  }, [isLaserOn, mapData, theme]);

  return canvasRef;
}
