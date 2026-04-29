import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f1e6cc",
        light: "#fef7e3",
        ink: "#1a3540",
        muted: "rgba(26, 53, 64, 0.68)",
        panel: "#fef7e3",
        surface: "#fff9ea",
        line: "rgba(26, 53, 64, 0.2)",
        accent: "#ff5728",
        good: "#1f7a3f",
        warn: "#b45309",
        weak: "#b91c1c",
      },
      borderRadius: {
        ui: "4px",
      },
      boxShadow: {
        stamp: "2px 2px 0 #1a3540",
        plate: "4px 4px 0 #1a3540",
        orange: "4px 4px 0 #ff5728",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Fraunces", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
