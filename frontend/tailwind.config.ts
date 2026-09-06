import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fsa: {
          navy: "#0E2841",
          blue: "#156082",
          "blue-600": "#124F6B",
          teal: "#3FB5AA",
          orange: "#E97132",
          "orange-600": "#D5611F",
          magenta: "#C0287E",
          green: "#1E7B34",
          red: "#C0392B",
          amber: "#E0A100",
          bg: "#FFFFFF",
          surface: "#F6F7F9",
          "surface-2": "#EEF1F4",
          border: "#E2E5EA",
          text: "#333333",
          muted: "#6B7280",
        },
      },
      fontFamily: {
        display: ["var(--font-poppins)", "Montserrat", "system-ui", "sans-serif"],
        sans: ["var(--font-open-sans)", "Roboto", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.15rem" }],
      },
      fontWeight: {
        "400": "400",
        "500": "500",
        "600": "600",
        "700": "700",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        lg: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,40,65,.06), 0 4px 16px rgba(14,40,65,.06)",
        "card-hover": "0 2px 4px rgba(14,40,65,.08), 0 8px 28px rgba(14,40,65,.10)",
      },
      spacing: {
        sidebar: "240px",
        header: "60px",
      },
    },
  },
  plugins: [],
};

export default config;
