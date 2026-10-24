import { useCallback, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { ItemRow } from "./ItemRow";

// `rows` come from buildRows(): each has the item plus its depth, progress and so on.
export function Checklist({
  rows,
  canEdit,
  dragEnabled,
  listType,
  suggestions,
  onTagPick,
  onPatch,
  onToggle,
  onDelete,
  onMove,
  onAddChild,
  onIndent,
  onOutdent,
  onToggleCollapse,
}) {
  const [announce, setAnnounce] = useState("");
  const [dragId, setDragId] = useState(null);
  const sensors = useSensors(
    // Handle has touch-action:none, so a short drag works on touch screens too.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // While an item is being dragged, what is under it folds away so the whole branch
  // moves as one. (Rows are in tree order, so parents always come before children.)
  const shown = useMemo(() => {
    if (!dragId) return rows;
    const hidden = new Set();
    return rows.filter((r) => {
      const p = r.item.parent_id ?? null;
      if (p !== null && (p === dragId || hidden.has(p))) {
        hidden.add(r.item.id);
        return false;
      }
      return true;
    });
  }, [rows, dragId]);

  // Any nesting in the list reserves a little room for the fold arrows.
  const nested = useMemo(() => rows.some((r) => r.hasChildren), [rows]);

  const onDragEnd = useCallback(
    ({ active, over }) => {
      setDragId(null);
      if (over && active.id !== over.id) {
        onMove(active.id, over.id);
        const title = rows.find((r) => r.item.id === active.id)?.item.text;
        setAnnounce(`Moved “${title}”`);
      }
    },
    [onMove, rows],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={({ active }) => setDragId(active.id)}
      onDragCancel={() => setDragId(null)}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={shown.map((r) => r.item.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-0.5" aria-label="Checklist items">
          <AnimatePresence initial={false}>
            {shown.map((row) => (
              <ItemRow
                key={row.item.id}
                row={row}
                nested={nested}
                canEdit={canEdit}
                dragEnabled={dragEnabled && canEdit}
                listType={listType}
                suggestions={suggestions}
                onTagPick={onTagPick}
                onPatch={(patch, opts) => onPatch(row.item.id, patch, opts)}
                onToggle={(completed) => onToggle(row.item.id, completed)}
                onDelete={() => onDelete(row.item.id)}
                onAddChild={(v) => onAddChild(row.item.id, v)}
                onIndent={() => onIndent(row.item.id)}
                onOutdent={() => onOutdent(row.item.id)}
                onToggleCollapse={() => onToggleCollapse(row.item.id)}
              />
            ))}
          </AnimatePresence>
        </ul>
      </SortableContext>
      <p className="sr-only" role="status">
        {announce}
      </p>
    </DndContext>
  );
}
