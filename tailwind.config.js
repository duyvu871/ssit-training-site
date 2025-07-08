/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.hbs",
    "./public/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 