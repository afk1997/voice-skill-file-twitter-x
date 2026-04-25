import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        muted: "#6b7280",
        panel: "#f8fafc",
        line: "#e5e7eb",
        accent: "#2563eb",
        good: "#15803d",
        warn: "#b45309",
        weak: "#b91c1c",
      },
      borderRadius: {
        ui: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
