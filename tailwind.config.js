/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",       // App Router support
    "./pages/**/*.{js,ts,jsx,tsx}",         // Pages Router support
    "./components/**/*.{js,ts,jsx,tsx}",    // Components
    "./src/**/*.{js,ts,jsx,tsx}",           // Any src-based files
    "./lib/**/*.{js,ts,jsx,tsx}",           // Utility files (optional)
  ],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/forms")],
};
