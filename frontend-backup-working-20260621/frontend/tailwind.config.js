/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        paper: '#F2EFE6',
        ink: '#1B2330',
        blueprint: '#2952A3',
        annotation: '#B8472E',
        graphite: '#6B6558',
        hairline: '#C9C2AE',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '4px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
      }
    }
  },
  plugins: [],
}