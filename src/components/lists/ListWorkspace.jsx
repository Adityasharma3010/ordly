import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArchiveRestore } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useToast } from "../../contexts/ToastContext";
import { api } from "../../services/api";
import { getStats, filterAndSortItems } from "../../utils/listStats";
import { usePersistentState } from "../../hooks/usePersistentState";
import { accentHex } from "../../utils/appearance";
import { plural } from "../../utils/format";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ListHeader } from "./ListHeader";
import { ListFormModal } from "./ListFormModal";
import { ProgressBar } from "../checklist/ProgressBar";
import { ItemComposer } from "../checklist/ItemComposer";
import { ChecklistToolbar } from "../checklist/ChecklistToolbar";
import { Checklist } from "../checklist/Checklist";
import { EmptyItems, NoMatches } from "../checklist/EmptyState";
import { ShareModal } from "../sharing/ShareModal";

export function ListWorkspace({ list }) {
  const ws = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [filter, setFilter] = useState("all");
  const [sort, setSort] = usePersistentState("ordly.sort", "custom");
  const [query, setQuery] = useState(params.get("q") || "");
  const [modal, setModal] = useState(null); // 'edit' | 'delete' | 'share'

  const canEdit = list.role !== "viewer";
  const isOwner = list.role === "owner";
  const stats = useMemo(() => getStats(list.items), [list.items]);
  const visible = useMemo(
    () => filterAndSortItems(list.items, { filter, sort, query }),
    [list.items, filter, sort, query],
  );
  const dragEnabled = sort === "custom" && filter === "all" && !query.trim();

  const archive = () => {
    ws.updateList(list.id, { archived: !list.archived });
    toast({
      tone: "success",
      message: list.archived ? "List restored" : "List archived",
      action: {
        label: "Undo",
        onClick: () => ws.updateList(list.id, { archived: list.archived }),
      },
    });
  };
  const duplicate = () => {
    const id = ws.duplicateList(list.id);
    if (id) {
      navigate(`/app/${id}`);
      toast({ tone: "success", message: "List duplicated (progress reset)" });
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-3xl px-4 pt-6 pb-32 sm:px-8 sm:pt-10"
      style={{ "--c-accent": accentHex(list.color) }}
    >
      <ListHeader
        list={list}
        canShare={isOwner}
        sharingEnabled={api.capabilities.sharing}
        onUpdate={(patch, opts) => ws.updateList(list.id, patch, opts)}
        onShare={() => setModal("share")}
        onEdit={() => setModal("edit")}
        onDuplicate={duplicate}
        onArchive={archive}
        onDelete={() => setModal("delete")}
      />

      {list.archived && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <span className="text-muted">This list is archived.</span>
          {isOwner && (
            <Button size="sm" onClick={archive}>
              <ArchiveRestore className="size-3.5" aria-hidden />
              Restore
            </Button>
          )}
        </div>
      )}

      <section data-anim="block" className="mt-6" aria-label="Progress">
        <div className="mb-2 flex items-baseline justify-between text-[13px]">
          <span className="text-muted">
            {stats.total === 0 ? (
              "No tasks with checkboxes yet"
            ) : (
              <>
                <b className="font-medium text-fg tabular-nums">{stats.done}</b>{" "}
                of {plural(stats.total, "task")} done
              </>
            )}
          </span>
          <span className="text-faint tabular-nums">
            {stats.remaining > 0 && `${stats.remaining} left · `}
            {plural(stats.totalItems, "item")}
          </span>
        </div>
        <ProgressBar stats={stats} />
      </section>

      {canEdit && (
        <div data-anim="block" className="mt-6">
          <ItemComposer onAdd={(v) => ws.addItem(list.id, v)} />
        </div>
      )}

      <div data-anim="block" className="mt-5">
        <ChecklistToolbar
          stats={stats}
          filter={filter}
          setFilter={setFilter}
          sort={sort}
          setSort={setSort}
          query={query}
          setQuery={setQuery}
          canEdit={canEdit}
          onClearCompleted={() => ws.clearCompleted(list.id)}
          onAll={(v) => ws.setAllCompleted(list.id, v)}
        />
      </div>

      <div className="mt-3">
        {list.items.length === 0 ? (
          <EmptyItems canEdit={canEdit} />
        ) : visible.length === 0 ? (
          <NoMatches
            onReset={() => {
              setFilter("all");
              setQuery("");
            }}
          />
        ) : (
          <Checklist
            items={visible}
            canEdit={canEdit}
            dragEnabled={dragEnabled}
            onPatch={(id, patch, opts) =>
              ws.updateItem(list.id, id, patch, opts)
            }
            onDelete={(id) => ws.removeItem(list.id, id)}
            onMove={(a, o) => ws.moveItem(list.id, a, o)}
          />
        )}
        {!dragEnabled &&
          canEdit &&
          list.items.length > 1 &&
          visible.length > 0 && (
            <p className="mt-3 px-2 text-xs text-faint">
              Reordering is available with Custom order, “All” filter and no
              search.
            </p>
          )}
      </div>

      <ListFormModal
        open={modal === "edit"}
        list={list}
        onClose={() => setModal(null)}
        onSubmit={(v) => ws.updateList(list.id, v)}
      />
      <ConfirmDialog
        open={modal === "delete"}
        onClose={() => setModal(null)}
        danger
        confirmLabel="Delete list"
        title={`Delete “${list.title}”?`}
        description={`This permanently deletes the list and its ${plural(list.items.length, "item")}${api.capabilities.sharing ? ", and revokes all share links" : ""}. This can’t be undone.`}
        onConfirm={() => {
          ws.deleteList(list.id);
          navigate("/app");
          toast({ message: "List deleted" });
        }}
      />
      <ShareModal
        open={modal === "share"}
        list={list}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
