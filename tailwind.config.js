/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './assets/js/**/*.js',
  ],
  safelist: [
    'text-blue-600',
    'dark:text-blue-300',
    'text-green-600',
    'dark:text-green-300',
    'text-red-600',
    'dark:text-red-400',
    'text-gray-600',
    'dark:text-gray-300',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

