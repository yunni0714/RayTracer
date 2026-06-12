import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { simulateLaser, clearLaser, setupCanvas, getBehavior } from '../lib/laserEngine';
import { onArtRasterReady } from '../lib/artClip';
import { getLastRotationEvent, ROTATION_ANIM_MS } from '../lib/pieceActions';
import type { CellData } from '../types/game';

// 회전 애니메이션이 진행 중이면 레이저 갱신을 종료 시점까지 미룬다.
// 연속 회전 시 effect 재실행 → cleanup 으로 타이머가 갱신돼 마지막만 그린다.
function rotationAnimRemaining(): number {
  const ev = getLastRotationEvent();
  if (!ev) return 0;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  return Math.max(0, ev.ts + ROTATION_ANIM_MS - Date.now());
}

// 빔을 직접 쏘는 기물인가 (발사기 / 사출 프로젝터)
function isEmitter(cell: CellData | null | undefined): boolean {
  return !!cell && (cell.type === 'ray' || !!getBehavior(cell.type).emit);
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

    // SVG 래스터(아트 클리핑용)가 비동기 준비되면 끝점이 바뀌므로 다시 그린다
    const offReady = onArtRasterReady(() => {
      const s = useGameStore.getState();
      if (s.isLaserOn && ctxRef.current) simulateLaser(ctxRef.current, canvas, s.mapData);
    });
    return () => { observer.disconnect(); offReady(); };
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

    // 회전 애니메이션 중: 발사기/프로젝터면 그 기물의 빔만 끈 상태로 즉시 다시 그린다
    // (off → 회전 → on). 다른 발사기의 빔은 그대로 유지된다.
    // 거울 등 비발사 기물은 회전 종료까지 기존 경로 유지(아래 타이머만).
    const ev = getLastRotationEvent()!;
    const rotatingCell = mapData[ev.row]?.[ev.col];
    if (isEmitter(rotatingCell)) {
      simulateLaser(ctx, canvas, mapData, { x: ev.col, y: ev.row });
    }

    // +20ms: 애니메이션 종료 프레임과 레이저 갱신이 겹쳐 보이지 않게 약간 여유
    const timer = window.setTimeout(() => simulateLaser(ctx, canvas, mapData), remaining + 20);
    return () => window.clearTimeout(timer);
  }, [isLaserOn, mapData, theme]);

  return canvasRef;
}
