import type { Config } from "tailwindcss";

/** Kalie Design System — matches DESIGN.md exactly */
const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ── Kalie Color Tokens ──────────────────────────────────────────────
      colors: {
        surface: "#141313",
        "surface-dim": "#141313",
        "surface-bright": "#3a3939",
        "surface-container-lowest": "#0e0e0e",
        "surface-container-low": "#1c1b1b",
        "surface-container": "#201f1f",
        "surface-container-high": "#2b2a2a",
        "surface-container-highest": "#353434",
        "on-surface": "#e5e2e1",
        "on-surface-variant": "#c4c7c7",
        "inverse-surface": "#e5e2e1",
        "inverse-on-surface": "#313030",
        outline: "#8e9192",
        "outline-variant": "#444748",
        "surface-tint": "#c9c6c5",
        primary: "#c9c6c5",
        "on-primary": "#313030",
        "primary-container": "#0d0d0d",
        "on-primary-container": "#7c7a7a",
        "inverse-primary": "#5f5e5e",
        secondary: "#c5c7c8",
        "on-secondary": "#2e3132",
        "secondary-container": "#494c4d",
        "on-secondary-container": "#babcbd",
        tertiary: "#cac6c3",
        "on-tertiary": "#32302f",
        "tertiary-container": "#0e0d0c",
        "on-tertiary-container": "#7d7a78",
        error: "#ffb4ab",
        "on-error": "#690005",
        "error-container": "#93000a",
        "on-error-container": "#ffdad6",
        background: "#141313",
        "on-background": "#e5e2e1",
        "surface-variant": "#353434",
        // Module accent colors
        "accent-sos": "#FF4D2E",
        "accent-bisno": "#00E5FF",
        "accent-games": "#BF5AF2",
        "accent-gold": "#FFD700",
        "accent-feed": "#00C853",
      },

      // ── Typography ──────────────────────────────────────────────────────
      fontFamily: {
        "space-grotesk": ["Space Grotesk", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
      fontSize: {
        h1: ["40px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["32px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["24px", { lineHeight: "1.2", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.4", fontWeight: "400" }],
        "label-caps": ["12px", { lineHeight: "1.0", letterSpacing: "0.05em", fontWeight: "700" }],
        button: ["16px", { lineHeight: "1.0", fontWeight: "600" }],
      },

      // ── Border Radius ───────────────────────────────────────────────────
      borderRadius: {
        sm: "0.5rem",
        DEFAULT: "1rem",
        md: "1.5rem",
        lg: "2rem",
        xl: "3rem",
        full: "9999px",
      },

      // ── Spacing ─────────────────────────────────────────────────────────
      spacing: {
        unit: "4px",
        "container-padding": "24px",
        "stack-gap": "16px",
        "section-margin": "40px",
        gutter: "16px",
      },

      // ── Backdrop blur ───────────────────────────────────────────────────
      backdropBlur: {
        glass: "20px",
        "glass-sm": "12px",
      },

      // ── Box shadows (glow effects) ──────────────────────────────────────
      boxShadow: {
        glass: "inset 1px 1px 0px rgba(255,255,255,0.1)",
        "glow-cyan": "0 0 30px rgba(0,229,255,0.2)",
        "glow-sos": "0 0 30px rgba(255,77,46,0.4)",
        "glow-games": "0 0 30px rgba(191,90,242,0.2)",
        "glow-feed": "0 0 30px rgba(0,200,83,0.2)",
      },

      // ── Animations ──────────────────────────────────────────────────────
      keyframes: {
        "pulse-sos": {
          "0%": { boxShadow: "0 0 0 0 rgba(255,77,46,0.4)" },
          "70%": { boxShadow: "0 0 0 15px rgba(255,77,46,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255,77,46,0)" },
        },
        "liquid-progress": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "pulse-sos": "pulse-sos 2s infinite",
        "liquid-progress": "liquid-progress 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
