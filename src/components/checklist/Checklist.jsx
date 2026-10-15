import { useCallback, useState } from "react";
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

export function Checklist({
  items,
  canEdit,
  dragEnabled,
  onPatch,
  onDelete,
  onMove,
}) {
  const [announce, setAnnounce] = useState("");
  const sensors = useSensors(
    // Handle has touch-action:none, so a short drag works on touch screens too.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = useCallback(
    ({ active, over }) => {
      if (over && active.id !== over.id) {
        onMove(active.id, over.id);
        const title = items.find((i) => i.id === active.id)?.text;
        setAnnounce(`Moved “${title}”`);
      }
    },
    [onMove, items],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-0.5" aria-label="Checklist items">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                canEdit={canEdit}
                dragEnabled={dragEnabled && canEdit}
                onPatch={(patch, opts) => onPatch(item.id, patch, opts)}
                onDelete={() => onDelete(item.id)}
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
