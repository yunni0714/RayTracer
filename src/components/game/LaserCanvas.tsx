import { forwardRef } from 'react';

// 크기는 부모(보드 래퍼)를 가득 채움. 백킹스토어 해상도는 useLaserCanvas가 dpr 반영해 동기화.
export const LaserCanvas = forwardRef<HTMLCanvasElement>((_, ref) => (
  <canvas
    ref={ref}
    className="absolute inset-0 w-full h-full z-[2] pointer-events-none"
  />
));
LaserCanvas.displayName = 'LaserCanvas';
