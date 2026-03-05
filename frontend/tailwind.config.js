/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          subtle: '#f1f5f9',
          border: '#e2e8f0',
          'border-strong': '#cbd5e1',
        },
        brand: {
          DEFAULT: '#7c3aed',
          light: '#8b5cf6',
          dark: '#6d28d9',
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
