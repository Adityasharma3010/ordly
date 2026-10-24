import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArchiveRestore } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useToast } from "../../contexts/ToastContext";
import { api } from "../../services/api";
import { getStats } from "../../utils/listStats";
import { plural } from "../../utils/format";
import { buildRows } from "../../utils/tree";
import { cleanTime } from "../../utils/due";
import { collectTags, listTypeOf } from "../../utils/meta";
import { listAncestorIds } from "../../utils/listTree";
import { usePersistentState } from "../../hooks/usePersistentState";
import { accentHex } from "../../utils/appearance";
import { Button } from "../ui/Button";
import { ListHeader } from "./ListHeader";
import { SaveTemplateModal } from "../templates/SaveTemplateModal";
import { TemplatePicker } from "../templates/TemplatePicker";
import { ListFormModal } from "./ListFormModal";
import { ProgressBar } from "../checklist/ProgressBar";
import { ItemComposer } from "../checklist/ItemComposer";
import { ChecklistToolbar } from "../checklist/ChecklistToolbar";
import { Checklist } from "../checklist/Checklist";
import { EmptyItems, NoMatches } from "../checklist/EmptyState";
import { ShareModal } from "../sharing/ShareModal";

export function ListWorkspace({ list, actions }) {
  const ws = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [filter, setFilter] = useState("all");
  const [sort, setSort] = usePersistentState("ordly.sort", "custom");
  const [query, setQuery] = useState(params.get("q") || "");
  const [tag, setTag] = useState(null); // show only items with this tag
  const [modal, setModal] = useState(null); // 'edit' | 'share' | 'template'

  const canEdit = list.role !== "viewer";
  const isOwner = list.role === "owner";
  // Which items are folded up, remembered per list on this device.
  const [foldedByList, setFoldedByList] = usePersistentState(
    "ordly.collapsed",
    {},
  );
  const folded = foldedByList[list.id];
  const stats = useMemo(() => getStats(list.items), [list.items]);
  const type = listTypeOf(list);
  const rows = useMemo(
    () =>
      buildRows(list.items, {
        filter,
        sort,
        query,
        tag,
        collapsed: folded || [],
      }),
    [list.items, filter, sort, query, tag, folded],
  );
  // Tags used on this list's items, and the ones used anywhere (offered as you type a tag).
  const itemTags = useMemo(
    () => collectTags([{ items: list.items }]),
    [list.items],
  );
  const allTags = useMemo(() => collectTags(ws.lists), [ws.lists]);
  const dueCount = useMemo(
    () => buildRows(list.items, { filter: "due" }).length,
    [list.items],
  );
  const crumbs = listAncestorIds(ws.lists, list.id)
    .reverse()
    .map((id) => ws.getList(id))
    .filter(Boolean);
  const setFolded = (id, fold) =>
    setFoldedByList((all) => {
      const next = new Set(all[list.id] || []);
      if (fold) next.add(id);
      else next.delete(id);
      return { ...all, [list.id]: [...next] };
    });
  const toggleFold = (id) => setFolded(id, !(folded || []).includes(id));
  const dragEnabled =
    sort === "custom" && filter === "all" && !query.trim() && !tag;

  // Archive, move and delete also take the lists inside this one, so they live in one
  // place (useListActions) that asks first when there are any.
  const archive = () => actions.archive(list);
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
        onSaveTemplate={() => setModal("template")}
        onArchive={archive}
        onMove={() => actions.askMove(list)}
        onAddTemplate={() => setModal("addTemplate")}
        onDelete={() => actions.askDelete(list)}
        crumbs={crumbs}
        onCrumb={(id) => navigate(`/app/${id}`)}
        done={stats.isComplete}
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

      {type !== "notes" && (
        <section data-anim="block" className="mt-6" aria-label="Progress">
          <div className="mb-2 flex items-baseline justify-between text-[13px]">
            <span className="text-muted">
              {stats.total === 0 ? (
                "No tasks with checkboxes yet"
              ) : (
                <>
                  <b className="font-medium text-fg tabular-nums">
                    {stats.done}
                  </b>{" "}
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
      )}

      {canEdit && (
        <div data-anim="block" className="mt-6">
          <ItemComposer
            onAdd={(v) => ws.addItem(list.id, v)}
            plainByDefault={type === "notes"}
          />
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
          dueCount={dueCount}
          tags={itemTags}
          tag={tag}
          setTag={setTag}
          notes={type === "notes"}
        />
      </div>

      <div className="mt-3">
        {list.items.length === 0 ? (
          <EmptyItems canEdit={canEdit} />
        ) : rows.length === 0 ? (
          <NoMatches
            onReset={() => {
              setFilter("all");
              setQuery("");
              setTag(null);
            }}
          />
        ) : (
          <Checklist
            rows={rows}
            canEdit={canEdit}
            dragEnabled={dragEnabled}
            listType={type}
            suggestions={allTags}
            onTagPick={setTag}
            onPatch={(id, patch, opts) =>
              ws.updateItem(list.id, id, patch, opts)
            }
            onToggle={(id, completed) => ws.toggleItem(list.id, id, completed)}
            onDelete={(id) => ws.removeItem(list.id, id)}
            onMove={(a, o) => ws.moveItem(list.id, a, o)}
            onAddChild={(parentId, v) => {
              setFolded(parentId, false); // show what you just added
              ws.addItem(list.id, { ...v, parent_id: parentId });
            }}
            onIndent={(id) => {
              const parentId = ws.indentItem(list.id, id);
              if (parentId) setFolded(parentId, false);
            }}
            onOutdent={(id) => ws.outdentItem(list.id, id)}
            onToggleCollapse={toggleFold}
          />
        )}
        {!dragEnabled &&
          canEdit &&
          list.items.length > 1 &&
          rows.length > 0 && (
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
        suggestions={allTags}
        onSubmit={(v) => {
          // Only send what actually changed.
          const now = {
            ...list,
            due_time: cleanTime(list.due_time),
            list_type: type,
            priority: list.priority ?? 0,
            tags: list.tags ?? [],
            due_date: list.due_date ?? null,
          };
          const patch = Object.fromEntries(
            Object.entries(v).filter(
              ([k, val]) => JSON.stringify(val) !== JSON.stringify(now[k]),
            ),
          );
          if (Object.keys(patch).length) ws.updateList(list.id, patch);
        }}
      />
      <TemplatePicker
        open={modal === "addTemplate"}
        onClose={() => setModal(null)}
        userTemplates={ws.templates}
        title="Add items from a template"
        description={`Pick one to add its items to the end of “${list.title}”. The list’s name and settings stay as they are.`}
        onPick={(t) => {
          setModal(null);
          ws.addTemplateToList(list.id, t);
        }}
        onDelete={(t) => {
          ws.deleteTemplate(t.id);
          toast({ message: "Template deleted" });
        }}
      />
      <SaveTemplateModal
        open={modal === "template"}
        list={list}
        onClose={() => setModal(null)}
        onSave={(name) => {
          const result = ws.saveTemplate(list.id, name);
          if (result.ok)
            toast({
              tone: "success",
              message: "Template saved. Find it on your home screen.",
            });
          return result;
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
