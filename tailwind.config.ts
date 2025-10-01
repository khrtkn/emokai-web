import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/styles/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
    "./src/ui/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#111111",
        textPrimary: "#EDF1F1",
        textSecondary: "rgba(237,241,241,0.7)",
        divider: "rgba(237,241,241,0.18)",
        accent: "#EDF1F1"
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" }
        }
      },
      animation: {
        marquee: "marquee 15s linear infinite"
      }
    }
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        ".animate-marquee": {
          animation: "marquee 15s linear infinite"
        }
      });
    })
  ]
};

export default config;
