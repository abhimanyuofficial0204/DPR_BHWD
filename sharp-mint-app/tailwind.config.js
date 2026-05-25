/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0b0c10',
        cardBg: 'rgba(25, 28, 36, 0.6)',
        borderBg: 'rgba(255, 255, 255, 0.08)',
        mintGreen: '#66fcf1',
        mintHover: '#45f3e5',
        deviationRed: 'rgba(220, 53, 69, 0.15)',
        deviationRedBorder: 'rgba(220, 53, 69, 0.4)',
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
