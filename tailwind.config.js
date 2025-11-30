/** @type {import('tailwindcss').Config} */
module.exports = {
  // Đảm bảo Tailwind quét các file React và HTML
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'orange-primary': '#f97316', // Màu cam chủ đạo
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      keyframes: {
        // Định nghĩa lại keyframes cho animate-fade-in-down (đã có trong index.css)
        fadeInDown: {
          'from': { opacity: 0, transform: 'translateY(-20px)' },
          'to': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-down': 'fadeInDown 0.3s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.3s ease-out forwards',
      }
    },
  },
  plugins: [],
}
