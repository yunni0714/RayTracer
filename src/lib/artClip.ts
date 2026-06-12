import { getSvgArt } from './svgArt';

/* ════════════════════════════════════════════════════════
   아트 클리핑 — 빔이 기물 SVG 의 "그려진 선"에 닿는 지점 계산.

   drawSegments 가 partial(표면 차단)/terminal(흡수·표적) 세그먼트의
   끝점을 셀 경계/중심 대신 아트 라인 위로 옮기는 데 쓴다.
   순수 렌더 보조 — 엔진 판정(computeLaser)에는 일절 관여하지 않는다.

   구현: SVG 를 오프스크린 캔버스에 래스터화(타입별 svg 문자열 키 캐시,
   config 오버라이드 시 문자열이 바뀌므로 자동 무효화) 후, 빔 진입
   경로를 따라 알파 채널을 샘플링해 첫 불투명 픽셀의 t 를 돌려준다.
   래스터화는 비동기(Image 로드) — 준비 전엔 null 을 반환하고,
   완료 시 onArtRasterReady 리스너로 재그리기를 요청한다.
   ════════════════════════════════════════════════════════ */

const RASTER = 64;        // 래스터 해상도 (셀 1변)
const ALPHA_MIN = 32;     // "그려진 선" 판정 알파 임계값
const SAMPLE_STEPS = 96;  // 진입 경로 샘플 수

// false = 로딩 중 / ImageData = 준비됨 / null = 실패(영구 폴백)
const cache = new Map<string, ImageData | false | null>();
const readyListeners = new Set<() => void>();

// 래스터 준비 완료 시 호출될 리스너 등록 (재그리기 트리거용). 해제 함수 반환.
export function onArtRasterReady(fn: () => void): () => void {
  readyListeners.add(fn);
  return () => readyListeners.delete(fn);
}

// 테스트/HMR 용 캐시 초기화
export function resetArtClipCache(): void {
  cache.clear();
}

// 래스터용 SVG 정규화: viewBox 만 있는 아트는 고유 크기가 없어 drawImage 가
// 깨진다(300×150 취급/미렌더) — 루트에 width/height 를 강제하고 xmlns 를 보장한다.
// (export 는 단위테스트용 — 렌더 경로는 rasterize 내부에서만 쓴다)
export function normalizeForRaster(svg: string): string {
  return svg.replace(/<svg\b[^>]*>/, tag => {
    let t = tag.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '');
    t = t.replace(/<svg\b/, m => `${m} width="${RASTER}" height="${RASTER}"`);
    if (!/\sxmlns\s*=/.test(t)) t = t.replace(/<svg\b/, m => `${m} xmlns="http://www.w3.org/2000/svg"`);
    return t;
  });
}

function rasterize(svg: string): void {
  cache.set(svg, false);
  const url = URL.createObjectURL(new Blob([normalizeForRaster(svg)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    try {
      const c = document.createElement('canvas');
      c.width = c.height = RASTER;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, RASTER, RASTER);
      cache.set(svg, ctx.getImageData(0, 0, RASTER, RASTER));
      readyListeners.forEach(f => f());
    } catch {
      cache.set(svg, null);
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    cache.set(svg, null);
  };
  img.src = url;
}

/**
 * 빔이 (dx,dy) 방향으로 셀에 진입할 때 기물 아트 라인에 처음 닿는 지점.
 * 반환값 t: 셀 진입 경계 = 0, 셀 중심 = 0.5 (셀 스텝 단위 비율).
 * insetFrac: 셀 내 아트 박스 인셋 비율 — GridCell 이 p-2(8px) 패딩 박스 안에
 *            SVG 를 그리므로 아트 좌표는 그만큼 축소돼 있다.
 * 아트 미준비/실패/경로상 아트 없음 → null (호출자가 기존 동작으로 폴백).
 */
export function getArtStopT(
  type: string, rotation: number, dx: number, dy: number, insetFrac = 0,
): number | null {
  const svg = getSvgArt(type);
  let data = cache.get(svg);
  if (data === undefined) {
    rasterize(svg);
    data = cache.get(svg);
  }
  if (!data) return null; // false(로딩 중) 또는 null(실패)

  // 기물은 CSS rotate(rotation) 로 그려진다 → 셀 좌표를 -rotation 회전해 아트 좌표로 샘플링
  const rad = (-rotation * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const span = 1 - 2 * insetFrac; // 아트 박스가 차지하는 셀 비율

  for (let i = 0; i <= SAMPLE_STEPS; i++) {
    const t = (i / SAMPLE_STEPS) * 0.5;
    // 셀 정규좌표(0..1): 중심 + (t-0.5)·(dx,dy) — t=0 진입 경계, t=0.5 중심
    const px = 0.5 + (t - 0.5) * dx;
    const py = 0.5 + (t - 0.5) * dy;
    // 회전(아트 박스도 셀 중심 기준으로 돈다) 후 패딩 인셋을 벗겨 아트 좌표로
    const rx = (0.5 + (px - 0.5) * cos - (py - 0.5) * sin - insetFrac) / span;
    const ry = (0.5 + (px - 0.5) * sin + (py - 0.5) * cos - insetFrac) / span;
    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) continue;
    const ix = Math.min(RASTER - 1, Math.max(0, Math.round(rx * (RASTER - 1))));
    const iy = Math.min(RASTER - 1, Math.max(0, Math.round(ry * (RASTER - 1))));
    if (data.data[(iy * RASTER + ix) * 4 + 3] >= ALPHA_MIN) return t;
  }
  return null;
}
