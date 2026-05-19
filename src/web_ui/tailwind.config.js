/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        mist: "#f7fbff",
        aurora: "#0f9f8f",
        sunrise: "#f59e0b",
        berry: "#7c3aed",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(23, 32, 51, 0.10)",
      },
    },
  },
  plugins: [],
};
