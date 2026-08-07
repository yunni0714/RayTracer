import { describe, it, expect, afterEach } from 'vitest';
import { sanitizeSvg, applyPieceConfig, resetPieceConfig } from '../src/lib/pieceConfig';
import { getSvgArt, SVG_ART } from '../src/lib/svgArt';

// config 의 SVG 는 전 플레이어에게 innerHTML 로 렌더된다 — 저장형 XSS 방어선.
// 여기서 막지 못한 문자열은 그대로 남의 브라우저에서 실행된다.

afterEach(() => resetPieceConfig());

// 새니타이즈 결과에 실행 가능한 잔재가 남았는지 — 브라우저 파서 기준으로 판정한다.
// on* 핸들러는 공백뿐 아니라 '/' 뒤에서도 속성으로 인식되므로 [\s/] 로 본다.
// 스킴은 엔티티/제어문자 위장을 푼 뒤 확인한다.
function residue(out: string): string[] {
  const found: string[] = [];
  if (/[\s/]on\w+\s*=/i.test(out)) found.push('on* 핸들러');
  if (/<\s*script/i.test(out)) found.push('script 태그');
  if (/<\s*foreignObject/i.test(out)) found.push('foreignObject');

  const decoded = out
    .replace(/&#x([0-9a-f]{1,6});?/gi, (m, h) => {
      const c = parseInt(h, 16);
      return c >= 0 && c <= 0x10ffff ? String.fromCodePoint(c) : m;
    })
    .replace(/&#(\d{1,7});?/g, (m, d) => {
      const c = parseInt(d, 10);
      return c >= 0 && c <= 0x10ffff ? String.fromCodePoint(c) : m;
    })
    .replace(/&colon;/gi, ':')
    .replace(/&(tab|newline);/gi, ' ');
  const flat = [...decoded].filter(ch => ch.charCodeAt(0) > 0x20).join('');
  if (/javascript:|vbscript:|data:text\/html/i.test(flat)) found.push('실행 URI 스킴');
  return found;
}

function expectInert(svg: string) {
  expect(residue(sanitizeSvg(svg))).toEqual([]);
}

describe('sanitizeSvg — script/foreignObject 제거', () => {
  it('script 쌍·자기종결·대문자·공백삽입을 모두 지운다', () => {
    expectInert('<svg><script>alert(1)</script></svg>');
    expectInert('<svg><SCRIPT>alert(1)</SCRIPT></svg>');
    expectInert('<svg>< script >alert(1)< / script ></svg>');
    expectInert('<svg><script src="//evil.test/x.js"/></svg>');
    expectInert('<svg><script src="//evil.test/x.js"></svg>');
  });

  it('중첩 위장 <scr<script>ipt> 도 남지 않는다', () => {
    expectInert('<svg><scr<script>ipt>alert(1)</script></svg>');
  });

  it('foreignObject 블록을 지운다', () => {
    expectInert('<svg><foreignObject><body onload="alert(1)"/></foreignObject></svg>');
  });
});

describe('sanitizeSvg — on* 이벤트 핸들러', () => {
  it('공백 구분자 변형을 지운다', () => {
    expectInert('<svg onload=alert(1)>');
    expectInert('<svg onload="alert(1)">');
    expectInert("<svg onload='alert(1)'>");
    expectInert('<svg\tonload=alert(1)>');
    expectInert('<svg\nonload = alert(1)>');
    expectInert('<circle r="1" onmouseover="x()"/>');
    expectInert('<svg><animate onbegin="alert(1)"/></svg>');
  });

  // 회귀: HTML 파서는 self-closing 슬래시 뒤에서 before-attribute-name 상태로 돌아가므로
  // '/' 도 속성 구분자다. 선행 문자를 \s 로만 보면 이 전부가 그대로 살아나갔다.
  it("'/' 구분자 변형을 지운다 (회귀)", () => {
    expectInert('<svg/onload=alert(1)>');
    expectInert('<svg//onload=alert(1)>');
    expectInert('<svg foo=1/onload=alert(1)>');
    expectInert('<svg/ONLOAD="alert(1)">');
    expectInert("<circle r=\"1\"/onmouseover='x()'/>");
    expectInert('<svg/onload=alert(1) /onerror=alert(2)>');
  });

  it('여러 핸들러가 한 태그에 있어도 전부 지운다', () => {
    expectInert('<svg onload="a()" onerror="b()" onclick=c()>');
  });
});

describe('sanitizeSvg — 실행 가능한 URI 스킴', () => {
  it('평문 javascript: 를 지운다', () => {
    expectInert('<a href="javascript:alert(1)">x</a>');
    expectInert('<a xlink:href="javascript:alert(1)">x</a>');
    expectInert('<a href=javascript:alert(1)>x</a>');
    expectInert('<a href="jAvAsCrIpT:alert(1)">x</a>');
  });

  // 회귀: 브라우저는 속성값의 엔티티를 파싱 시점에 푼다 — 리터럴 'javascript:' 만
  // 지우는 필터는 &#106;avascript: 를 그대로 통과시켰다.
  it('엔티티로 위장한 스킴을 지운다 (회귀)', () => {
    expectInert('<a xlink:href="&#106;avascript:alert(1)">x</a>');
    expectInert('<a href="&#x6a;avascript:alert(1)">x</a>');
    expectInert('<a href="javascript&colon;alert(1)">x</a>');
    expectInert('<a href="java&#9;script:alert(1)">x</a>');
    expectInert('<a href="java&newline;script:alert(1)">x</a>');
  });

  it('SMIL 간접 참조(set/animate)도 지운다', () => {
    expectInert('<svg><set attributeName="href" to="javascript:alert(1)"/></svg>');
    expectInert('<svg><animate attributeName="href" values="&#106;avascript:alert(1)"/></svg>');
  });

  it('vbscript: 와 data:text/html 을 지운다', () => {
    expectInert('<a href="vbscript:msgbox(1)">x</a>');
    expectInert('<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>');
  });
});

describe('sanitizeSvg — 정상 SVG 보존 (과잉 차단 회귀)', () => {
  it('빌트인 기물 아트는 한 글자도 안 바뀐다', () => {
    for (const [type, art] of Object.entries(SVG_ART)) {
      expect(sanitizeSvg(art), `${type} 아트가 변형됨`).toBe(art);
    }
  });

  it('일반 도형·좌표·스타일 속성은 유지된다', () => {
    const svg = '<svg viewBox="0 0 100 100"><path d="M10 10L90 90" stroke="#fff" stroke-width="2"/>'
      + '<circle cx="50" cy="50" r="8" fill="var(--ray)"/></svg>';
    expect(sanitizeSvg(svg)).toBe(svg);
  });

  it('data:image 임베드 래스터는 막지 않는다', () => {
    const svg = '<svg><image href="data:image/png;base64,iVBORw0KGgo="/></svg>';
    expect(sanitizeSvg(svg)).toBe(svg);
  });

  it("'on' 으로 시작하는 정상 속성명은 핸들러로 오인하지 않는다", () => {
    const svg = '<svg><text font-family="Onyx">once</text></svg>';
    expect(sanitizeSvg(svg)).toBe(svg);
  });
});

describe('sanitizeSvg — 디코딩 안전성', () => {
  // 탐지용 디코딩이 출력으로 새면 &#60; 가 '<' 로 부활해 XSS 가 되살아난다.
  it('엔티티는 출력에서 디코딩되지 않는다', () => {
    const svg = '<svg><text>&#60;script&#62;alert(1)&#60;/script&#62;</text></svg>';
    const out = sanitizeSvg(svg);
    expect(out).toContain('&#60;');
    expect(out).not.toContain('<script>');
  });

  it('범위를 벗어난 엔티티에도 throw 하지 않는다', () => {
    expect(() => sanitizeSvg('<a href="&#99999999;javascript:alert(1)">x</a>')).not.toThrow();
    expect(() => sanitizeSvg('<a href="&#xFFFFFFF;x">y</a>')).not.toThrow();
  });
});

describe('config 경유 SVG 는 반드시 새니타이즈를 거친다', () => {
  it('applyPieceConfig 로 들어온 악성 SVG 가 접근자에서 무해화된다', () => {
    applyPieceConfig({
      version: 1,
      pieces: {
        mirror: {
          svg: '<svg viewBox="0 0 100 100"/onload=alert(1)><rect/>'
            + '<a xlink:href="&#106;avascript:alert(2)">x</a></svg>',
        },
      },
    });
    const art = getSvgArt('mirror');
    expect(residue(art)).toEqual([]);
    // 무해한 내용은 살아남는다 — 통째로 버리면 기물이 안 보인다
    expect(art).toContain('<rect/>');
  });

  it('새니타이즈 후 <svg 로 시작하지 않으면 오버라이드가 통째로 버려진다', () => {
    applyPieceConfig({
      version: 1,
      pieces: { mirror: { svg: '<script>alert(1)</script>' } },
    });
    expect(getSvgArt('mirror')).toBe(SVG_ART.mirror);
  });
});
