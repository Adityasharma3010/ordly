import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Pause, Play, SkipForward, Undo2 } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { DueChip, PriorityChip, TagChips } from "../ui/MetaChips";
import { Markdown } from "../notes/Markdown";
import {
  focusQueue,
  formatClock,
  orderQueue,
  skipItem,
} from "../../utils/focus";
import { plural } from "../../utils/format";

// One task at a time. Nothing here is saved by itself: "Done" ticks the item through the
// normal auto-save (onToggle), and the skip order and timer only live while this is open.
export function FocusMode({ open, onClose, list, onToggle }) {
  const reduce = useReducedMotion();
  const [skipped, setSkipped] = useState([]);
  const [doneIds, setDoneIds] = useState([]); // ticked in this session, newest last
  const [running, setRunning] = useState(false);
  const [spent, setSpent] = useState({}); // item id -> seconds

  const queue = useMemo(
    () => orderQueue(focusQueue(list.items), skipped),
    [list.items, skipped],
  );
  const current = queue[0] ?? null;
  const currentId = current?.item.id ?? null;
  const focusedSeconds = Object.values(spent).reduce((a, b) => a + b, 0);

  const close = useCallback(() => {
    setSkipped([]);
    setDoneIds([]);
    setRunning(false);
    setSpent({});
    onClose();
  }, [onClose]);

  // The timer counts for whichever task is on screen.
  useEffect(() => {
    if (!open || !running || !currentId) return;
    const t = setInterval(
      () => setSpent((s) => ({ ...s, [currentId]: (s[currentId] || 0) + 1 })),
      1000,
    );
    return () => clearInterval(t);
  }, [open, running, currentId]);

  const finish = () => {
    if (!current) return;
    onToggle(current.item.id, true);
    setDoneIds((d) => [...d, current.item.id]);
  };
  const skip = () => {
    if (current && queue.length > 1)
      setSkipped((s) => skipItem(s, current.item.id));
  };
  const undo = () => {
    const last = doneIds[doneIds.length - 1];
    if (!last) return;
    onToggle(last, false);
    setDoneIds((d) => d.slice(0, -1));
  };

  // Letter shortcuts: D done, S skip, T timer, U undo (Esc is handled by the dialog).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest("input,textarea"))
        return;
      const k = e.key.toLowerCase();
      if (k === "d") finish();
      else if (k === "s") skip();
      else if (k === "t") setRunning((r) => !r);
      else if (k === "u") undo();
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const left = queue.length;
  const summary = [
    doneIds.length > 0 && `${doneIds.length} done`,
    focusedSeconds > 0 && `${formatClock(focusedSeconds)} focused`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Modal
      open={open}
      onClose={close}
      title="Focus"
      description={list.title}
      size="lg"
    >
      <div aria-live="polite">
        {current ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.item.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
              className="py-4"
            >
              <p className="text-xs text-faint tabular-nums">
                {plural(left, "task")} left
              </p>
              {current.path.length > 0 && (
                <p className="mt-2 text-[13px] text-muted">
                  {current.path.join("  ›  ")}
                </p>
              )}
              <h3 className="mt-2 font-serif text-3xl leading-snug break-words sm:text-4xl">
                {current.item.text}
              </h3>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 empty:hidden">
                <DueChip source={current.item} />
                <PriorityChip priority={current.item.priority} />
                <TagChips tags={current.item.tags} />
              </div>
              {current.item.notes && (
                <Markdown
                  text={current.item.notes}
                  className="mt-4 text-sm text-muted"
                />
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="py-10 text-center">
            <h3 className="font-serif text-3xl">
              {doneIds.length > 0 ? "All clear" : "Nothing to focus on"}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {doneIds.length > 0
                ? "Every open task in this list is done."
                : "This list has no open tasks with checkboxes."}
            </p>
          </div>
        )}
      </div>

      {current && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-line bg-raised/50 px-4 py-3">
          <div>
            <p className="text-[11px] tracking-wide text-faint uppercase">
              Time on this task
            </p>
            <p className="text-2xl tabular-nums" data-testid="focus-clock">
              {formatClock(spent[currentId] || 0)}
            </p>
          </div>
          <Button size="sm" onClick={() => setRunning((r) => !r)}>
            {running ? (
              <Pause className="size-3.5" aria-hidden />
            ) : (
              <Play className="size-3.5" aria-hidden />
            )}
            {running ? "Pause timer" : "Start timer"}
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {current && (
          <>
            <Button variant="primary" size="lg" onClick={finish}>
              <Check className="size-4" aria-hidden />
              Done
            </Button>
            <Button size="lg" onClick={skip} disabled={queue.length < 2}>
              <SkipForward className="size-4" aria-hidden />
              Skip for now
            </Button>
          </>
        )}
        {doneIds.length > 0 && (
          <Button variant="ghost" size="lg" onClick={undo}>
            <Undo2 className="size-4" aria-hidden />
            Undo
          </Button>
        )}
        {!current && (
          <Button variant="primary" size="lg" onClick={close}>
            Close
          </Button>
        )}
      </div>

      <p className="mt-4 text-xs text-faint">
        {summary && <span className="mr-3 text-muted">{summary}</span>}
        <span className="hidden sm:inline">
          Keys: D done · S skip · T timer · U undo · Esc close
        </span>
      </p>
    </Modal>
  );
}
