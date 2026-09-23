/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Paper, ink and one highlighter yellow. Same tokens as the extension (apps/extension/src/ui/styles.css).
      colors: {
        paper: { DEFAULT: "#F7F4EE", 2: "#ECE6DA" },
        card: "#FFFEFB",
        ink: { DEFAULT: "#1C1A17", 2: "#5B564D", 3: "#6E685E" },
        body: "#3D3932",
        line: { DEFAULT: "#E6E0D4", 2: "#D6CFC2" },
        marker: "#FFD84D",
        rust: "#B3412E",
        leaf: "#2F7D55"
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', "system-ui", "sans-serif"],
        serif: ['"Fraunces Variable"', "Georgia", "serif"]
      }
    }
  },
  plugins: []
};
