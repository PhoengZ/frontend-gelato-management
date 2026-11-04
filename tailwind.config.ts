import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-anuphan)", ...defaultTheme.fontFamily.sans]
      },
      colors: {
        // Gelatte brand tokens (Figma: Gelatte / Tokens)
        ink: "#141012",
        subtle: "#6B6266",
        canvas: "#FFFAF4",
        line: "#EFE6E2",
        pink: {
          DEFAULT: "#F88397",
          soft: "#FDE4E8",
          strong: "#E8566F"
        },
        pistachio: { soft: "#E8F0DC" },
        vanilla: { soft: "#FBF1DC" },
        success: "#33A05C",

        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        }
      },
      boxShadow: {
        float: "0 12px 28px -8px rgba(20, 16, 18, 0.22)",
        sheet: "0 -8px 32px rgba(20, 16, 18, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
