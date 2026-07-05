import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import type { PenTool } from '../../store/gameStore';

// 테스트(플레이) 모드 전용 필기 오버레이.
// - 그리드 밖(여백)에서 우클릭 → 마우스 중심 방사형 메뉴(3색/지우개/전체지우기/펜끄기).
// - 캔버스는 항상 pointer-events:none. 펜 활성 중엔 useGridDragDrop 이 좌클릭을 필기에
//   양보하므로 그리드 안/밖 어디서든 그리기를 시작할 수 있다. 우클릭 회전은 그대로 동작.
// - 인벤/팔레트 기물 선택(setSelectedTool) 시엔 스토어가 penTool 을 'off' 로 되돌린다.
//   기물 회전(rotatePiece)은 펜을 끄지 않는다 — 회전 후에도 이어서 그릴 수 있게.
// - 획은 컴포넌트 로컬 state → 언마운트(테스트 종료)/맵 전환(key 리마운트) 시 자동 소멸.
// - 레이저와 분리된 별도 캔버스라 지우개는 레이저에 영향 없음.

type Pt = { x: number; y: number };                 // 캔버스 기준 0~1 정규화
interface Stroke { tool: 'blue' | 'green' | 'red'; width: number; pts: Pt[]; }

const RADIAL_R = 70;   // 아이템 배치 반경
const HIT_PX = 12;     // 지우개 hit 반경
const STROKE_W = 3;

const COLOR_VAR: Record<'blue' | 'green' | 'red', string> = {
  blue: 'var(--pen-blue)', green: 'var(--pen-green)', red: 'var(--pen-red)',
};
const TOOL_LABEL: Record<PenTool, string> = {
  off: '펜 꺼짐', blue: '파랑', green: '초록', red: '빨강', erase: '지우개',
};

const ITEMS: { tool: PenTool | 'clear'; title: string }[] = [
  { tool: 'blue', title: '파랑' },
  { tool: 'green', title: '초록' },
  { tool: 'red', title: '빨강' },
  { tool: 'erase', title: '지우개' },
  { tool: 'clear', title: '전체 지우기' },
  { tool: 'off', title: '펜 끄기' },
];

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function PenLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokesRef = useRef<Stroke[]>([]);          // 렌더는 ref로(리렌더 없이 그림)
  const curRef = useRef<Stroke | null>(null);
  const erasingRef = useRef(false);

  const tool = useGameStore(s => s.penTool);
  const setTool = useGameStore(s => s.setPenTool);
  const toolRef = useRef<PenTool>(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  const [radial, setRadial] = useState<{ x: number; y: number } | null>(null);

  // 테스트 종료(언마운트) 시 펜 상태 초기화
  useEffect(() => () => { useGameStore.getState().setPenTool('off'); }, []);

  // ── 색 문자열 해석(토큰 → 실제 색) ──
  const resolvedColor = useCallback((t: 'blue' | 'green' | 'red') => {
    const el = canvasRef.current;
    if (!el) return '#3b82f6';
    return getComputedStyle(el).getPropertyValue(`--pen-${t}`).trim() || COLOR_VAR[t];
  }, []);

  const drawStroke = useCallback((s: Stroke) => {
    const ctx = ctxRef.current, canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (s.pts.length < 1) return;
    ctx.save();
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.lineWidth = s.width;
    ctx.strokeStyle = resolvedColor(s.tool);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(s.pts[0].x * W, s.pts[0].y * H);
    for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x * W, s.pts[i].y * H);
    if (s.pts.length === 1) ctx.lineTo(s.pts[0].x * W + 0.1, s.pts[0].y * H + 0.1);
    ctx.stroke();
    ctx.restore();
  }, [resolvedColor]);

  const redraw = useCallback(() => {
    const ctx = ctxRef.current, canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    for (const s of strokesRef.current) drawStroke(s);
  }, [drawStroke]);

  // ── 캔버스 크기(dpr) 설정 + 전체 재그리기 ──
  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxRef.current = ctx;
    redraw();
  }, [redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setup();
    const ro = new ResizeObserver(setup);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [setup]);

  // ── 좌표 변환 ──
  const toNorm = useCallback((clientX: number, clientY: number): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height };
  }, []);

  // 그리드(보드) 영역 = data-board-grid 마커 rect. 이 안은 기물 몫 → 그리기/메뉴 제외.
  const isOverGrid = useCallback((clientX: number, clientY: number): boolean => {
    const grid = document.querySelector('[data-board-grid]');
    if (!grid) return false;
    const r = grid.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }, []);

  const inCanvas = useCallback((clientX: number, clientY: number): boolean => {
    const r = canvasRef.current?.getBoundingClientRect();
    return !!r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }, []);

  // ── 지우개: 커서 근처 획 통째 삭제 ──
  const eraseAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const W = canvas.clientWidth, H = canvas.clientHeight;
    const px = clientX - rect.left, py = clientY - rect.top;
    const before = strokesRef.current.length;
    strokesRef.current = strokesRef.current.filter(s => {
      const p = s.pts;
      if (p.length === 1) return Math.hypot(px - p[0].x * W, py - p[0].y * H) > HIT_PX + s.width;
      for (let i = 1; i < p.length; i++) {
        if (distToSeg(px, py, p[i - 1].x * W, p[i - 1].y * H, p[i].x * W, p[i].y * H) <= HIT_PX + s.width / 2) return false;
      }
      return true;
    });
    if (strokesRef.current.length !== before) redraw();
  }, [redraw]);

  // ── 그리기 입력: 중앙 섹션(캔버스 부모)에 리스너. 캔버스는 pointer-events:none 이고
  //    펜 활성 중엔 그리드가 좌클릭을 양보하므로 그리드 안/밖 모두 좌드래그로 그린다. ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.parentElement;
    if (!section) return;

    function onDown(e: PointerEvent) {
      if (e.button !== 0) return;
      if (radial) return;                                   // 메뉴 열림 상태는 바깥클릭 핸들러가 처리
      const t = toolRef.current;
      if (t === 'off') return;
      // 선택 기물 팝오버(회전/회수 등) 버튼 위 클릭은 그리기 대신 버튼 조작에 양보
      if ((e.target as HTMLElement).closest('[data-testid="piece-popover"]')) return;
      if (!inCanvas(e.clientX, e.clientY)) return;
      section!.setPointerCapture?.(e.pointerId);
      if (t === 'erase') { erasingRef.current = true; eraseAt(e.clientX, e.clientY); return; }
      const s: Stroke = { tool: t, width: STROKE_W, pts: [toNorm(e.clientX, e.clientY)] };
      strokesRef.current.push(s);
      curRef.current = s;
      drawStroke(s);
    }
    function onMove(e: PointerEvent) {
      if (erasingRef.current) { eraseAt(e.clientX, e.clientY); return; }
      if (!curRef.current) return;
      curRef.current.pts.push(toNorm(e.clientX, e.clientY));
      redraw();
    }
    function onUp() { curRef.current = null; erasingRef.current = false; }

    section.addEventListener('pointerdown', onDown);
    section.addEventListener('pointermove', onMove);
    section.addEventListener('pointerup', onUp);
    section.addEventListener('pointercancel', onUp);
    return () => {
      section.removeEventListener('pointerdown', onDown);
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerup', onUp);
      section.removeEventListener('pointercancel', onUp);
    };
  }, [radial, isOverGrid, inCanvas, eraseAt, toNorm, drawStroke, redraw]);

  // ── 우클릭 → 방사형 메뉴 (그리드 밖 + 중앙 섹션 안에서만; 그리드 위는 기물 회전) ──
  useEffect(() => {
    function onCtx(e: MouseEvent) {
      if (radial) { e.preventDefault(); setRadial(null); return; }
      if (isOverGrid(e.clientX, e.clientY)) return;         // 기물 회전에 양보
      if (!inCanvas(e.clientX, e.clientY)) return;          // 사이드 패널 등 다른 UI 보존
      e.preventDefault();
      setRadial({ x: e.clientX, y: e.clientY });
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setRadial(null); setTool('off'); }
    }
    window.addEventListener('contextmenu', onCtx);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('contextmenu', onCtx); window.removeEventListener('keydown', onKey); };
  }, [radial, isOverGrid, inCanvas, setTool]);

  // 메뉴 열렸을 때 바깥 클릭 닫기
  useEffect(() => {
    if (!radial) return;
    function onDown(e: PointerEvent) {
      if (!(e.target as HTMLElement).closest('[data-pen-radial]')) setRadial(null);
    }
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [radial]);

  const pickItem = useCallback((t: PenTool | 'clear') => {
    if (t === 'clear') { strokesRef.current = []; redraw(); }
    else setTool(t);
    setRadial(null);
  }, [redraw, setTool]);

  return (
    <>
      {/* 항상 pointer-events:none — 그리드/기물 조작을 절대 막지 않는다 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-[3] pointer-events-none touch-none"
      />

      {/* 현재 도구 표시(도구 활성 시) */}
      {tool !== 'off' && !radial && (
        <div className="absolute top-1 left-1 z-[4] pointer-events-none flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] text-ink-muted border border-line">
          {tool !== 'erase'
            ? <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: COLOR_VAR[tool] }} />
            : <span>🩹</span>}
          {TOOL_LABEL[tool]} · 그리드 위/밖 필기 · 우클릭 메뉴 · Esc 끄기
        </div>
      )}

      {/* 방사형 메뉴 (fixed, 마우스 중심) */}
      {radial && (
        <div data-pen-radial className="fixed inset-0 z-[60]" style={{ pointerEvents: 'auto' }}>
          <div className="absolute" style={{ left: radial.x, top: radial.y }}>
            {ITEMS.map((it, i) => {
              const a = -Math.PI / 2 + (Math.PI * 2 / ITEMS.length) * i;
              const tx = Math.cos(a) * RADIAL_R, ty = Math.sin(a) * RADIAL_R;
              return (
                <button
                  key={it.tool}
                  type="button"
                  title={it.title}
                  onClick={() => pickItem(it.tool)}
                  className="pen-radial-item absolute grid place-items-center w-11 h-11 -ml-[22px] -mt-[22px] rounded-full bg-surface border border-line shadow-md text-lg hover:brightness-125 hover:border-ink transition-[transform,opacity]"
                  style={{ transform: `translate(${tx}px, ${ty}px)`, animationDelay: `${i * 30}ms` }}
                >
                  {it.tool === 'blue' || it.tool === 'green' || it.tool === 'red'
                    ? <span className="w-5 h-5 rounded-full" style={{ background: COLOR_VAR[it.tool] }} />
                    : it.tool === 'erase' ? '🩹' : it.tool === 'clear' ? '🗑️' : '✋'}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
