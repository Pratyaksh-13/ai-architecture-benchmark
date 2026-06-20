/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        dark: {
          950: "#0a0a0f",
          900: "#0f1117",
          800: "#161b27",
          750: "#1a2030",
          700: "#1e2535",
          600: "#252d3d",
          500: "#2d3748",
        },
        accent: {
          purple: "#7c3aed",
          purple_light: "#a78bfa",
          purple_dim: "#4c1d95",
          teal: "#14b8a6",
          teal_dim: "#042f2e",
          amber: "#f59e0b",
          amber_dim: "#451a03",
        }
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        'fade-in': 'fade-in 0.3s ease-out',
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
        'slide-in': 'slide-in 0.25s ease-out',
      },
    }
  },
  plugins: [],
}