import { describe, it, expect } from 'vitest';
import { normalizeForRaster } from '../src/lib/artClip';
import { SVG_ART } from '../src/lib/svgArt';

describe('normalizeForRaster — 래스터용 SVG 정규화', () => {
  it('viewBox 만 있는 빌트인 아트에 width/height/xmlns 를 주입한다', () => {
    const out = normalizeForRaster(SVG_ART.high_block);
    const root = out.match(/<svg\b[^>]*>/)![0];
    expect(root).toContain('width="64"');
    expect(root).toContain('height="64"');
    expect(root).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(root).toContain('viewBox="0 0 100 100"');
  });

  it('기존 width/height 는 제거 후 교체한다 (XML 중복 속성 파스 에러 방지)', () => {
    const out = normalizeForRaster('<svg width="100" height=\'100\' viewBox="0 0 100 100"><rect/></svg>');
    const root = out.match(/<svg\b[^>]*>/)![0];
    expect(root.match(/width=/g)).toHaveLength(1);
    expect(root.match(/height=/g)).toHaveLength(1);
    expect(root).toContain('width="64"');
  });

  it('xmlns 가 이미 있으면 중복 주입하지 않는다', () => {
    const out = normalizeForRaster('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>');
    expect(out.match(/xmlns=/g)).toHaveLength(1);
  });

  it('루트 외 내부 요소의 width/height 속성은 건드리지 않는다', () => {
    const out = normalizeForRaster('<svg viewBox="0 0 100 100"><rect width="10" height="10"/></svg>');
    expect(out).toContain('<rect width="10" height="10"/>');
  });
});
