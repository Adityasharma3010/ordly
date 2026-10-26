// Colour maths for the accent colour picker. Colours are "#rrggbb" strings everywhere.

export const isHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);

// "f0b24b", "#F0B24B" or "#fb4" -> "#f0b24b"; anything else -> null.
export function normalizeHex(v) {
  let s = String(v ?? "")
    .trim()
    .replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(s))
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toLowerCase()}` : null;
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export const rgbToHex = ({ r, g, b }) =>
  "#" +
  [r, g, b]
    .map((x) =>
      Math.max(0, Math.min(255, Math.round(x)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

// h 0-360, s and v 0-1
export function hexToHsv(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}
export function hsvToHex({ h, s, v }) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return rgbToHex({ r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 });
}

// WCAG relative luminance and contrast ratio (1 to 21).
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Whichever of the app's dark ink or white reads better on top of `hex`.
const DARK_INK = "#17130a";
export const readableOn = (hex) =>
  contrast(hex, DARK_INK) >= contrast(hex, "#ffffff") ? DARK_INK : "#ffffff";

// The page backgrounds, to warn when a chosen accent would be hard to see on them.
export const PAGE_BG = { dark: "#0e1116", light: "#f1f2f4" };
export const isHardToSee = (hex, theme) => contrast(hex, PAGE_BG[theme]) < 2.2;
