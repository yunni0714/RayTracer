/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── 시맨틱 토큰 (CSS 변수 기반, 다크모드 자동 전환) ──
        canvas:    'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          2:       'var(--surface-2)',
          3:       'var(--surface-3)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong:  'var(--line-strong)',
        },
        ink: {
          DEFAULT: 'var(--text)',
          muted:   'var(--text-muted)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          ink:     'var(--primary-ink)',
          soft:    'var(--primary-soft)',
        },
        success:   'var(--success)',
        danger: {
          DEFAULT: 'var(--danger)',
          soft:    'var(--danger-soft)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft:    'var(--warning-soft)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft:    'var(--accent-soft)',
        },
        laser:     'var(--laser)',

        // ── 레거시 색 (점진 마이그레이션 전까지 유지) ──
        'ray-purple':  '#8e44ad',
        'ray-green':   '#27ae60',
        'ray-blue':    '#2980b9',
        'ray-red':     '#e74c3c',
        'ray-orange':  '#e67e22',
        'ray-dark':    '#2c3e50',
        'ray-panel':   '#ecf0f1',
        'diff-tutor':  '#3498db',
        'diff-easy':   '#2ecc71',
        'diff-normal': '#f39c12',
        'diff-hard':   '#e67e22',
        'diff-insane': '#e74c3c',
      },
      borderRadius: {
        card: '12px',
        tile: '8px',
      },
      boxShadow: {
        card: 'var(--shadow-sm)',
        cardhover: 'var(--shadow-md)',
      },
      gridTemplateColumns: {
        'game-grid': 'repeat(5, 100px)',
        'palette':   'repeat(3, 1fr)',
      },
      gridTemplateRows: {
        'game-grid': 'repeat(5, 100px)',
      },
      width: {
        'game-grid': '500px',
      },
      height: {
        'game-grid': '500px',
      },
    },
  },
  plugins: [],
}
