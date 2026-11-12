/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B1120',
        surface: '#10192E',
        card: '#141F38',
        line: '#1E293B',
        accent: '#2DD4BF',
        accent2: '#8B5CF6',
        ink: '#F1F5F9',
        muted: '#94A3B8',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(45,212,191,0.35), 0 12px 32px -12px rgba(45,212,191,0.35)',
        card: '0 1px 2px rgba(0,0,0,0.4), 0 12px 24px -18px rgba(0,0,0,0.9)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
