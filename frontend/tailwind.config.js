/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          900: "#0f1117",
          800: "#161b27",
          700: "#1e2535",
          600: "#252d3d",
        },
        accent: {
          purple: "#7c3aed",
          purple_light: "#a78bfa",
          teal: "#14b8a6",
          amber: "#f59e0b",
        }
      }
    }
  },
  plugins: [],
}