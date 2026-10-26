import { isHex, readableOn } from "./color";

// List accent colours. Stored by key so palettes can change without a migration.
export const ACCENTS = {
  amber: "#f0b24b",
  coral: "#f0806c",
  sage: "#7fcba5",
  sky: "#6db6f1",
  violet: "#a996f6",
  rose: "#ef8fb7",
  stone: "#a4acbd",
};
export const ACCENT_KEYS = Object.keys(ACCENTS);

// A list's colour is one of the names above, or a custom "#rrggbb" picked with the colour
// picker. (Older lists set to "system" simply show amber.)
export const accentHex = (key) =>
  isHex(key) ? key.toLowerCase() : ACCENTS[key] || ACCENTS.amber;

// What an area of the page needs to use a list's colour: the accent itself and the text colour
// that reads well on top of it. Also resets anything the whole-app colour set, so a list keeps
// its own colour. (`accent-custom` is the CSS class that works out lighter / darker text tints.)
export function accentStyle(key) {
  if (isHex(key)) {
    const hex = key.toLowerCase();
    return {
      className: "accent-custom",
      style: { "--c-accent": hex, "--c-on-accent": readableOn(hex) },
    };
  }
  return {
    className: "",
    style: {
      "--c-accent": accentHex(key),
      "--c-on-accent": "#17130a",
      "--c-ink": "initial",
    },
  };
}

export const EMOJI_CHOICES = [
  "📝",
  "🛒",
  "✈️",
  "🎯",
  "📚",
  "🏠",
  "💡",
  "🎬",
  "🍳",
  "💪",
  "🌱",
  "🎁",
  "🧳",
  "🛠️",
  "🎵",
  "☕",
];
