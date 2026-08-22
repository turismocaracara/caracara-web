import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#1B3D52',
          light: '#2a5a76',
          dark: '#112837',
        },
        orange: {
          DEFAULT: '#D4511A',
          light: '#e86835',
          dark: '#a83d12',
        },
        cream: {
          DEFAULT: '#F8F4EF',
          dark: '#ede6db',
        },
        ink: '#1A1A2E',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
