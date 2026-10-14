import { sortByPosition } from './position'

// Only items that have a checkbox count toward progress. Plain-text items never do.
export function getStats(items) {
  const checkable = items.filter((i) => i.has_checkbox)
  const done = checkable.filter((i) => i.completed).length
  const total = checkable.length
  return {
    totalItems: items.length,
    total,
    done,
    remaining: total - done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    isComplete: total > 0 && done === total,
  }
}

export const FILTERS = ['all', 'active', 'completed']
export const SORTS = ['custom', 'created', 'status']

export function filterAndSortItems(items, { filter = 'all', sort = 'custom', query = '' } = {}) {
  const q = query.trim().toLowerCase()
  let out = items
  if (filter === 'active') out = out.filter((i) => i.has_checkbox && !i.completed)
  if (filter === 'completed') out = out.filter((i) => i.has_checkbox && i.completed)
  if (q) out = out.filter((i) => i.text.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q))

  if (sort === 'created') return [...out].sort((a, b) => b.created_at.localeCompare(a.created_at))
  if (sort === 'status') {
    const rank = (i) => (!i.has_checkbox ? 1 : i.completed ? 2 : 0)
    return [...out].sort((a, b) => rank(a) - rank(b) || a.position - b.position)
  }
  return sortByPosition(out)
}

// Search across every list's title, description and item text.
export function searchWorkspace(lists, query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const results = []
  for (const list of lists) {
    const titleHit = list.title.toLowerCase().includes(q)
    const descHit = list.description.toLowerCase().includes(q)
    const itemHits = list.items.filter((i) => i.text.toLowerCase().includes(q))
    if (titleHit || descHit || itemHits.length) {
      results.push({ list, titleHit, descHit, itemHits: sortByPosition(itemHits).slice(0, 3), itemHitCount: itemHits.length })
    }
  }
  return results
}

export const VIEWS = {
  all: 'All lists',
  favorites: 'Favorites',
  recent: 'Recently updated',
  shared: 'Shared with me',
  archived: 'Archived',
}

export function listsForView(lists, view) {
  const active = lists.filter((l) => !l.archived)
  switch (view) {
    case 'favorites': return active.filter((l) => l.favorite)
    case 'recent':
      return [...active].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 12)
    case 'shared': return active.filter((l) => l.role !== 'owner')
    case 'archived': return lists.filter((l) => l.archived)
    default: return active
  }
}
