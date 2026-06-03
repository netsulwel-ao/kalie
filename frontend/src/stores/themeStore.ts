/**
 * Theme store — Zustand
 * Persists theme preference and applies dark/light class to <html>.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark" as Theme,

      setTheme: (theme: Theme) => {
        applyTheme(theme);
        set({ theme });
      },

      toggleTheme: () => {
        set((state) => {
          const next: Theme = state.theme === "dark" ? "light" : "dark";
          applyTheme(next);
          return { theme: next };
        });
      },
    }),
    {
      name: "kalie-theme",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
