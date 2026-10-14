// List accent colours. Stored by key so palettes can change without a migration.
export const ACCENTS = {
  amber: '#f0b24b',
  coral: '#f0806c',
  sage: '#7fcba5',
  sky: '#6db6f1',
  violet: '#a996f6',
  rose: '#ef8fb7',
  stone: '#a4acbd',
}
export const ACCENT_KEYS = Object.keys(ACCENTS)
export const accentHex = (key) => ACCENTS[key] || ACCENTS.amber

export const EMOJI_CHOICES = ['📝', '🛒', '✈️', '🎯', '📚', '🏠', '💡', '🎬', '🍳', '💪', '🌱', '🎁', '🧳', '🛠️', '🎵', '☕']
