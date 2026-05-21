/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
