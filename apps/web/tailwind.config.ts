import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f8f9ff",
        foreground: "#0d1c2f",

        primary: "#003441",
        "primary-container": "#0f4c5c",
        "on-primary": "#ffffff",
        "on-primary-container": "#87bbce",
        "primary-fixed": "#b6ebfe",
        "primary-fixed-dim": "#9acee1",
        "on-primary-fixed": "#001f28",
        "on-primary-fixed-variant": "#114d5d",

        secondary: "#006c49",
        "secondary-container": "#6cf8bb",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#00714d",
        "secondary-fixed": "#6ffbbe",
        "secondary-fixed-dim": "#4edea3",
        "on-secondary-fixed": "#002113",
        "on-secondary-fixed-variant": "#005236",

        tertiary: "#d9383a",
        "tertiary-dark": "#67000b",
        "tertiary-container": "#910013",
        "on-tertiary": "#ffffff",
        "on-tertiary-container": "#ff9790",
        "tertiary-fixed": "#ffdad7",
        "tertiary-fixed-dim": "#ffb3ae",

        surface: "#f8f9ff",
        "surface-dim": "#ccdbf4",
        "surface-bright": "#f8f9ff",
        "surface-variant": "#d5e3fd",
        "surface-tint": "#306576",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e6eeff",
        "surface-container-high": "#dde9ff",
        "surface-container-highest": "#d5e3fd",

        "on-surface": "#0d1c2f",
        "on-surface-variant": "#40484b",
        "inverse-surface": "#233144",
        "inverse-on-surface": "#ebf1ff",
        "inverse-primary": "#9acee1",

        outline: "#70787c",
        "outline-variant": "#c0c8cb",

        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
