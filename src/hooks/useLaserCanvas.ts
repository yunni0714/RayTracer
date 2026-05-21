import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { simulateLaser, clearLaser, setupCanvas } from '../lib/laserEngine';

export function useLaserCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const isLaserOn = useGameStore(s => s.isLaserOn);
  const mapData = useGameStore(s => s.mapData);

  // Canvas 초기 설정 (마운트 시 1회)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = setupCanvas(canvas);
  }, []);

  // isLaserOn 또는 mapData 변경 시마다 레이저 재계산
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    if (isLaserOn) {
      simulateLaser(ctx, canvas, mapData);
    } else {
      clearLaser(ctx, canvas);
    }
  }, [isLaserOn, mapData]);

  return canvasRef;
}
