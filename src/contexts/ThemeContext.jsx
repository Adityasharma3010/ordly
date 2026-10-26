import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isHex, readableOn } from "../utils/color";

const ThemeContext = createContext(null);

const initialAccent = () => {
  try {
    const v = localStorage.getItem("ordly.accent.color");
    return isHex(v) ? v.toLowerCase() : null;
  } catch {
    return null;
  }
};

const initialTheme = () => {
  try {
    return localStorage.getItem("ordly.theme") || "dark";
  } catch {
    return "dark";
  }
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  // A custom accent colour for the whole app ("#rrggbb"), or null for Ordly's amber. Kept on
  // this device only.
  const [accentColor, setAccentColor] = useState(initialAccent);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("accent-custom", !!accentColor);
    if (accentColor) {
      root.style.setProperty("--c-accent", accentColor);
      root.style.setProperty("--c-on-accent", readableOn(accentColor));
    } else {
      root.style.removeProperty("--c-accent");
      root.style.removeProperty("--c-on-accent");
    }
    try {
      if (accentColor) localStorage.setItem("ordly.accent.color", accentColor);
      else localStorage.removeItem("ordly.accent.color");
    } catch {
      /* private mode */
    }
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("ordly.theme", theme);
    } catch {
      /* private mode */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0e1116" : "#f1f2f4");
  }, [theme]);

  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );
  const value = useMemo(
    () => ({ theme, toggle, accentColor, setAccentColor }),
    [theme, toggle, accentColor],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
