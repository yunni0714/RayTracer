import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { simulateLaser, clearLaser, setupCanvas } from '../lib/laserEngine';

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

    if (isLaserOn) {
      simulateLaser(ctx, canvas, mapData);
    } else {
      clearLaser(ctx, canvas);
    }
  }, [isLaserOn, mapData, theme]);

  return canvasRef;
}
