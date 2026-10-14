// Fractional ordering: each item has a numeric `position`. Moving an item only
// rewrites that one row (midpoint between its new neighbours), so reordering
// is a single cheap save and concurrent reorders rarely conflict.
export const POSITION_STEP = 1024

export function positionAtEnd(items) {
  if (!items.length) return POSITION_STEP
  return Math.max(...items.map((i) => i.position)) + POSITION_STEP
}

export function positionBetween(before, after) {
  if (before == null && after == null) return POSITION_STEP
  if (before == null) return after - POSITION_STEP
  if (after == null) return before + POSITION_STEP
  return (before + after) / 2
}

// Given the ordered array AFTER a move, compute the moved item's new position.
export function positionForMovedItem(orderedItems, movedId) {
  const idx = orderedItems.findIndex((i) => i.id === movedId)
  if (idx === -1) return null
  const before = orderedItems[idx - 1]?.position ?? null
  const after = orderedItems[idx + 1]?.position ?? null
  return positionBetween(before, after)
}

export function sortByPosition(items) {
  return [...items].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
}
