/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17201c',
        muted: '#657168',
        parchment: '#fffdf8',
        moss: {
          50: '#f4f8f1',
          100: '#e8f1e3',
          600: '#2f6f4f',
          800: '#173d2a',
          900: '#10281d'
        },
        brass: '#b9852f'
      },
      boxShadow: {
        soft: '0 18px 48px rgba(23, 32, 28, 0.08)'
      }
    }
  },
  plugins: []
};
