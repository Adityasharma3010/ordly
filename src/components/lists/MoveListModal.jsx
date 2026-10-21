import { Check, Layers } from "lucide-react";
import { Modal } from "../ui/Modal";
import { accentHex } from "../../utils/appearance";
import { moveTargets } from "../../utils/listTree";

// "Move to…": pick the top level or one of your own lists. Lists that would end up inside
// themselves are not offered. Shown while `list` is set.
export function MoveListModal({ list, lists, onClose, onPick }) {
  return (
    <Modal
      open={!!list}
      onClose={onClose}
      title={`Move “${list?.title ?? ""}”`}
      description="Pick where this list should go. Its own sharing stays exactly as it is."
    >
      {list && <Targets list={list} lists={lists} onPick={onPick} />}
    </Modal>
  );
}

function Targets({ list, lists, onPick }) {
  const rows = moveTargets(lists, list.id);
  const current = list.parent_list_id ?? null;
  const row =
    "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-muted transition-colors hover:bg-raised hover:text-fg disabled:cursor-default disabled:text-fg";
  return (
    <ul
      className="scroll-thin mt-3 max-h-72 space-y-0.5 overflow-y-auto"
      aria-label="Where to move this list"
    >
      <li>
        <button
          type="button"
          className={row}
          disabled={current === null}
          onClick={() => onPick(null)}
        >
          <Layers className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate">Top level</span>
          {current === null && <Check className="size-4" aria-hidden />}
        </button>
      </li>
      {rows.map(({ list: l, depth }) => (
        <li key={l.id}>
          <button
            type="button"
            className={row}
            style={{ paddingLeft: 10 + Math.min(depth, 6) * 16 }}
            disabled={current === l.id}
            onClick={() => onPick(l.id)}
          >
            <span
              className="grid size-5 shrink-0 place-items-center text-[15px]"
              style={{ color: accentHex(l.color) }}
            >
              {l.icon || (
                <span
                  className="size-2 rounded-full"
                  style={{ background: accentHex(l.color) }}
                  aria-hidden
                />
              )}
            </span>
            <span className="flex-1 truncate">{l.title}</span>
            {current === l.id && <Check className="size-4" aria-hidden />}
          </button>
        </li>
      ))}
    </ul>
  );
}
