import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";
import { useSave } from "./SaveContext";
import { useToast } from "./ToastContext";
import { nowIso, plural, uid } from "../utils/format";
import {
  positionAtEnd,
  positionBetween,
  positionForMovedItem,
  sortByPosition,
  POSITION_STEP,
} from "../utils/position";
import { computeRollup, siblingsOf, subtreeIds } from "../utils/tree";
import { canMoveList, listSubtreeIds } from "../utils/listTree";
import {
  MAX_TEMPLATE_BYTES,
  MAX_TEMPLATE_DEPTH,
  templateBytes,
  templateDepth,
  templateItems,
  templateTreeFromItems,
} from "../utils/templates";

const WorkspaceContext = createContext(null);

const touch = (l) => ({ ...l, updated_at: nowIso() });

function reducer(state, a) {
  const mapList = (id, fn) => state.lists.map((l) => (l.id === id ? fn(l) : l));
  switch (a.type) {
    case "loaded":
      return {
        status: "ready",
        error: null,
        lists: a.lists,
        templates: a.templates ?? state.templates,
      };
    case "addTemplate":
      return { ...state, templates: [a.template, ...state.templates] };
    case "removeTemplate":
      return {
        ...state,
        templates: state.templates.filter((t) => t.id !== a.id),
      };
    case "loading":
      return { ...state, status: "loading", error: null };
    case "error":
      return {
        ...state,
        status: state.status === "ready" ? "ready" : "error",
        error: a.error,
      };
    case "addList":
      return { ...state, lists: [a.list, ...state.lists] };
    case "patchList":
      return {
        ...state,
        lists: mapList(a.id, (l) => touch({ ...l, ...a.patch })),
      };
    case "patchLists": {
      const ids = new Set(a.ids);
      return {
        ...state,
        lists: state.lists.map((l) =>
          ids.has(l.id) ? touch({ ...l, ...a.patch }) : l,
        ),
      };
    }
    case "removeLists": {
      const ids = new Set(a.ids);
      return { ...state, lists: state.lists.filter((l) => !ids.has(l.id)) };
    }
    case "addItems":
      return {
        ...state,
        lists: mapList(a.listId, (l) =>
          touch({ ...l, items: [...l.items, ...a.items] }),
        ),
      };
    case "patchItem":
      return {
        ...state,
        lists: mapList(a.listId, (l) =>
          touch({
            ...l,
            items: l.items.map((i) =>
              i.id === a.itemId
                ? { ...i, ...a.patch, updated_at: nowIso() }
                : i,
            ),
          }),
        ),
      };
    case "patchItems": {
      const ids = new Set(a.ids);
      return {
        ...state,
        lists: mapList(a.listId, (l) =>
          touch({
            ...l,
            items: l.items.map((i) =>
              ids.has(i.id) ? { ...i, ...a.patch } : i,
            ),
          }),
        ),
      };
    }
    case "removeItems": {
      const ids = new Set(a.ids);
      return {
        ...state,
        lists: mapList(a.listId, (l) =>
          touch({ ...l, items: l.items.filter((i) => !ids.has(i.id)) }),
        ),
      };
    }
    default:
      return state;
  }
}

const DEBOUNCE_MS = 600;
const INITIAL = { status: "loading", error: null, lists: [], templates: [] };

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const save = useSave();
  const { toast } = useToast();
  const [state, rawDispatch] = useReducer(reducer, INITIAL);
  // Mirror of the latest state, updated synchronously on every dispatch so that
  // back-to-back actions (create a list, then add items) see each other's results.
  const stateRef = useRef(INITIAL);
  const dispatch = useCallback((action) => {
    stateRef.current = reducer(stateRef.current, action);
    rawDispatch(action);
  }, []);

  const userId = user?.id;
  const timers = useRef(new Map());
  const persist = save.run;

  // ---------- Loading & live updates ----------
  const reload = useCallback(async () => {
    if (!userId) return;
    if (stateRef.current.status === "error") dispatch({ type: "loading" });
    try {
      // Templates are a bonus: if they can't be loaded (for example the database step
      // for them has not been run yet) the lists must still open.
      const [lists, templates] = await Promise.all([
        api.fetchWorkspace(userId),
        Promise.resolve()
          .then(() => api.listTemplates())
          .catch(() => undefined),
      ]);
      dispatch({ type: "loaded", lists, templates });
    } catch (e) {
      dispatch({ type: "error", error: e.message });
    }
  }, [dispatch, userId]);

  useEffect(() => {
    if (!userId) return;
    reload();
  }, [userId, reload]);

  // Pull in remote changes, but never while local edits are unsaved: that would
  // overwrite newer local work with stale server data.
  useEffect(() => {
    if (!userId || !api.capabilities.realtime) return;
    let t;
    const attempt = () => {
      if (save.isBusy() || timers.current.size > 0) {
        t = setTimeout(attempt, 900);
        return;
      }
      reload();
    };
    const onChange = () => {
      clearTimeout(t);
      t = setTimeout(attempt, 350);
    };
    const off = api.subscribe(onChange);
    const onVisible = () => {
      if (document.visibilityState === "visible") onChange();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(t);
      off();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, reload, save]);

  // ---------- Debounced text saves ----------
  const debounced = useCallback(
    (key, patch, write) => {
      const cur = timers.current.get(key);
      if (cur) clearTimeout(cur.t);
      const merged = { ...(cur?.patch || {}), ...patch };
      const run = () => {
        timers.current.delete(key);
        persist(() => write(merged));
      };
      timers.current.set(key, {
        t: setTimeout(run, DEBOUNCE_MS),
        patch: merged,
        run,
      });
    },
    [persist],
  );

  const flushPending = useCallback(() => {
    for (const e of [...timers.current.values()]) {
      clearTimeout(e.t);
      e.run();
    }
  }, []);

  useEffect(() => {
    const onHide = () => flushPending();
    const onUnload = (e) => {
      flushPending();
      if (save.isBusy()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onUnload);
      flushPending();
    };
  }, [flushPending, save]);

  // ---------- Lists ----------
  const getList = useCallback(
    (id) => stateRef.current.lists.find((l) => l.id === id),
    [],
  );

  const createList = useCallback(
    ({
      title = "Untitled list",
      description = "",
      icon = "",
      color = "amber",
      parent_list_id = null,
      list_type = "checklist",
      due_date = null,
      due_time = null,
      priority = 0,
      tags = [],
    } = {}) => {
      const now = nowIso();
      // A sub-list can only go inside a list of yours.
      const parent = parent_list_id ? getList(parent_list_id) : null;
      const list = {
        id: uid(),
        owner_id: userId,
        parent_list_id: parent?.role === "owner" ? parent.id : null,
        list_type,
        due_date,
        due_time,
        priority,
        tags,
        title: title.trim() || "Untitled list",
        description,
        icon,
        color,
        favorite: false,
        archived: false,
        created_at: now,
        updated_at: now,
        role: "owner",
        items: [],
      };
      dispatch({ type: "addList", list });
      persist(() => api.createList(list));
      return list.id;
    },
    [userId, persist, dispatch, getList],
  );

  const updateList = useCallback(
    (id, patch, { debounce = false } = {}) => {
      dispatch({ type: "patchList", id, patch });
      if (debounce)
        debounced(`list:${id}`, patch, (p) => api.updateList(id, p));
      else persist(() => api.updateList(id, patch));
    },
    [dispatch, debounced, persist],
  );

  // A new list that starts with a template's items (nested as the template nests them).
  // Anything in `v` (name, icon, colour, type, due date…) replaces what the template says;
  // the template only fills in what you left out.
  const createListFromTemplate = useCallback(
    (template, v = {}) => {
      const now = nowIso();
      const id = uid();
      const parent = v.parent_list_id ? getList(v.parent_list_id) : null;
      const list = {
        id,
        owner_id: userId,
        parent_list_id: parent?.role === "owner" ? parent.id : null,
        list_type: v.list_type ?? "checklist",
        due_date: v.due_date ?? null,
        due_time: v.due_time ?? null,
        priority: v.priority ?? 0,
        tags: v.tags ?? [],
        title: (v.title?.trim() || template.title || "Untitled list").slice(
          0,
          200,
        ),
        description: (v.description ?? template.description ?? "").slice(
          0,
          2000,
        ),
        icon: v.icon ?? template.icon ?? "",
        color: v.color || template.color || "amber",
        favorite: false,
        archived: false,
        created_at: now,
        updated_at: now,
        role: "owner",
        items: templateItems(template, id, { uid, now }),
      };
      if (list.list_type === "notes")
        list.items = list.items.map((i) => ({ ...i, has_checkbox: false }));
      dispatch({ type: "addList", list });
      persist(() => api.createList(list));
      if (list.items.length) persist(() => api.insertItems(list.items));
      return id;
    },
    [dispatch, userId, persist, getList],
  );

  // Adds a template's items to the END of a list you can edit (its name and settings stay).
  // Shows an Undo toast. Returns how many items were added.
  const addTemplateToList = useCallback(
    (listId, template) => {
      const list = getList(listId);
      if (!list || list.role === "viewer") return 0;
      const now = nowIso();
      const last = siblingsOf(list.items, null).reduce(
        (m, i) => Math.max(m, i.position),
        0,
      );
      let items = templateItems(template, listId, {
        uid,
        now,
        startAfter: last,
      });
      if (list.list_type === "notes")
        items = items.map((i) => ({ ...i, has_checkbox: false }));
      if (!items.length) return 0;
      dispatch({ type: "addItems", listId, items });
      persist(() => api.insertItems(items));
      const ids = items.map((i) => i.id);
      toast({
        tone: "success",
        message: `Added ${plural(items.length, "item")} from “${template.title}”`,
        action: {
          label: "Undo",
          onClick: () => {
            dispatch({ type: "removeItems", listId, ids });
            persist(() => api.deleteItems(ids));
          },
        },
      });
      return items.length;
    },
    [dispatch, getList, persist, toast],
  );

  // Keeps a list's items as a template. Returns { ok: true } or { ok: false, reason }.
  const saveTemplate = useCallback(
    (listId, name) => {
      const list = getList(listId);
      if (!list) return { ok: false, reason: "missing" };
      if (!list.items.length) return { ok: false, reason: "empty" };
      const items = templateTreeFromItems(list.items);
      if (templateDepth(items) > MAX_TEMPLATE_DEPTH)
        return { ok: false, reason: "too-deep" };
      if (templateBytes(items) > MAX_TEMPLATE_BYTES)
        return { ok: false, reason: "too-big" };
      const template = {
        id: uid(),
        title: (name?.trim() || list.title).slice(0, 200),
        icon: list.icon || "",
        color: list.color || "amber",
        description: (list.description || "").slice(0, 2000),
        items,
        created_at: nowIso(),
      };
      dispatch({ type: "addTemplate", template });
      persist(() => api.createTemplate(template));
      return { ok: true, id: template.id };
    },
    [dispatch, getList, persist],
  );

  const deleteTemplate = useCallback(
    (id) => {
      dispatch({ type: "removeTemplate", id });
      persist(() => api.deleteTemplate(id));
    },
    [dispatch, persist],
  );

  const duplicateList = useCallback(
    (id) => {
      const src = getList(id);
      if (!src) return null;
      const now = nowIso();
      const copy = {
        id: uid(),
        owner_id: userId,
        // The copy sits next to the original (sub-lists inside it are not copied).
        parent_list_id:
          src.role === "owner" ? (src.parent_list_id ?? null) : null,
        title: `${src.title} (copy)`.slice(0, 200),
        description: src.description,
        icon: src.icon,
        color: src.color,
        list_type: src.list_type ?? "checklist",
        due_date: src.due_date ?? null,
        due_time: src.due_time ?? null,
        priority: src.priority ?? 0,
        tags: src.tags ?? [],
        favorite: false,
        archived: false,
        created_at: now,
        updated_at: now,
        role: "owner",
        items: [],
      };
      const sorted = sortByPosition(src.items);
      const newId = new Map(sorted.map((i) => [i.id, uid()]));
      copy.items = sorted.map((i) => ({
        ...i,
        id: newId.get(i.id),
        list_id: copy.id,
        parent_id: i.parent_id ? (newId.get(i.parent_id) ?? null) : null,
        completed: false,
        created_at: now,
        updated_at: now,
      }));
      dispatch({ type: "addList", list: copy });
      persist(() => api.createList(copy));
      persist(() => api.insertItems(copy.items));
      return copy.id;
    },
    [dispatch, getList, userId, persist],
  );

  // Deleting a list deletes the lists inside it too (the database does the same).
  const deleteList = useCallback(
    (id) => {
      const ids = listSubtreeIds(stateRef.current.lists, id);
      dispatch({ type: "removeLists", ids });
      persist(() => api.deleteList(id));
    },
    [dispatch, persist],
  );

  // Move a list inside another list of yours (null = back to the top level).
  // Returns false when that isn't allowed, so the screen can say so.
  const moveList = useCallback(
    (id, parentId) => {
      const lists = stateRef.current.lists;
      const list = lists.find((l) => l.id === id);
      const parent = parentId ? lists.find((l) => l.id === parentId) : null;
      if (!list || list.role !== "owner") return false;
      if (parentId && parent?.role !== "owner") return false;
      if (!canMoveList(lists, id, parentId)) return false;
      if ((list.parent_list_id ?? null) === (parentId ?? null)) return true;
      updateList(id, { parent_list_id: parentId ?? null });
      return true;
    },
    [updateList],
  );

  // Archive or restore a list together with everything inside it. Returns what changed so
  // the caller can offer Undo: { ids, previous } where previous maps id -> archived before.
  const setListArchived = useCallback(
    (id, archived) => {
      const lists = stateRef.current.lists;
      const ids = listSubtreeIds(lists, id).filter(
        (x) => lists.find((l) => l.id === x)?.role === "owner",
      );
      const previous = Object.fromEntries(
        ids.map((x) => [x, lists.find((l) => l.id === x).archived]),
      );
      dispatch({ type: "patchLists", ids, patch: { archived } });
      persist(() => api.updateLists(ids, { archived }));
      return { ids, previous };
    },
    [dispatch, persist],
  );

  const undoArchive = useCallback(
    ({ previous }) => {
      for (const archived of [true, false]) {
        const ids = Object.keys(previous).filter(
          (x) => previous[x] === archived,
        );
        if (!ids.length) continue;
        dispatch({ type: "patchLists", ids, patch: { archived } });
        persist(() => api.updateLists(ids, { archived }));
      }
    },
    [dispatch, persist],
  );

  // ---------- Items ----------
  const addItem = useCallback(
    (listId, { text, has_checkbox = true, parent_id = null }) => {
      const list = getList(listId);
      const clean = text.trim();
      if (!list || !clean) return null;
      if (parent_id && !list.items.some((i) => i.id === parent_id)) return null;
      const now = nowIso();
      const item = {
        id: uid(),
        list_id: listId,
        text: clean,
        notes: "",
        has_checkbox,
        completed: false,
        position: positionAtEnd(siblingsOf(list.items, parent_id)),
        parent_id,
        due_date: null,
        due_time: null,
        priority: 0,
        tags: [],
        created_at: now,
        updated_at: now,
      };
      dispatch({ type: "addItems", listId, items: [item] });
      persist(() => api.insertItems([item]));
      return item.id;
    },
    [dispatch, getList, persist],
  );

  const updateItem = useCallback(
    (listId, itemId, patch, { debounce = false } = {}) => {
      dispatch({ type: "patchItem", listId, itemId, patch });
      if (debounce)
        debounced(`item:${itemId}`, patch, (p) => api.updateItem(itemId, p));
      else persist(() => api.updateItem(itemId, patch));
    },
    [dispatch, debounced, persist],
  );

  const removeItem = useCallback(
    (listId, itemId) => {
      const list = getList(listId);
      if (!list?.items.some((i) => i.id === itemId)) return;
      // Deleting an item takes everything under it too.
      const ids = new Set(subtreeIds(list.items, itemId));
      const gone = list.items.filter((i) => ids.has(i.id));
      for (const id of ids) {
        const pending = timers.current.get(`item:${id}`);
        if (pending) {
          clearTimeout(pending.t);
          timers.current.delete(`item:${id}`);
        }
      }
      dispatch({ type: "removeItems", listId, ids: [...ids] });
      persist(() => api.deleteItems([...ids]));
      toast({
        message:
          gone.length > 1
            ? `Item and ${plural(gone.length - 1, "sub-item")} deleted`
            : "Item deleted",
        action: {
          label: "Undo",
          onClick: () => {
            dispatch({ type: "addItems", listId, items: gone });
            persist(() => api.insertItems(gone));
          },
        },
      });
    },
    [dispatch, getList, persist, toast],
  );

  // Give a group of siblings fresh, evenly spaced positions (gaps can shrink after many
  // moves). `extra` lets one item change parent in the same step.
  const renumber = useCallback(
    (listId, ordered, extra = {}) => {
      ordered.forEach((i, idx) => {
        const patch = { position: (idx + 1) * POSITION_STEP, ...extra[i.id] };
        dispatch({ type: "patchItem", listId, itemId: i.id, patch });
        persist(() => api.updateItem(i.id, patch));
      });
    },
    [dispatch, persist],
  );

  // Drag-to-reorder happens among siblings. If you drop on a row that is deeper in the
  // tree, the sibling that contains it is used.
  const moveItem = useCallback(
    (listId, activeId, overId) => {
      const list = getList(listId);
      if (!list || activeId === overId) return;
      const byId = new Map(list.items.map((i) => [i.id, i]));
      const active = byId.get(activeId);
      if (!active) return;
      const parentId = active.parent_id ?? null;
      let target = byId.get(overId);
      while (target && (target.parent_id ?? null) !== parentId)
        target = byId.get(target.parent_id);
      if (!target || target.id === activeId) return;

      const ordered = siblingsOf(list.items, parentId);
      const from = ordered.findIndex((i) => i.id === activeId);
      const to = ordered.findIndex((i) => i.id === target.id);
      if (from < 0 || to < 0) return;
      const next = [...ordered];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      const pos = positionForMovedItem(next, activeId);
      const before = next[to - 1]?.position;
      const after = next[to + 1]?.position;
      if (before != null && after != null && Math.abs(after - before) < 1e-6) {
        renumber(listId, next);
        return;
      }
      if (pos == null) return;
      updateItem(listId, activeId, { position: pos });
    },
    [getList, updateItem, renumber],
  );

  // Indent: become the last sub-item of the item just above (at the same level).
  // Returns that item's id so the screen can unfold it, or null if there is nothing above.
  const indentItem = useCallback(
    (listId, itemId) => {
      const list = getList(listId);
      const item = list?.items.find((i) => i.id === itemId);
      if (!item) return null;
      const sibs = siblingsOf(list.items, item.parent_id ?? null);
      const at = sibs.findIndex((i) => i.id === itemId);
      if (at < 1) return null;
      const parent = sibs[at - 1];
      const position = positionAtEnd(siblingsOf(list.items, parent.id));
      updateItem(listId, itemId, { parent_id: parent.id, position });
      return parent.id;
    },
    [getList, updateItem],
  );

  // Outdent: move up one level, landing right after the item it used to sit under.
  const outdentItem = useCallback(
    (listId, itemId) => {
      const list = getList(listId);
      const item = list?.items.find((i) => i.id === itemId);
      const parent = list?.items.find((i) => i.id === item?.parent_id);
      if (!item || !parent) return;
      const grandId = parent.parent_id ?? null;
      const sibs = siblingsOf(list.items, grandId);
      const at = sibs.findIndex((i) => i.id === parent.id);
      const before = parent.position;
      const after = sibs[at + 1]?.position ?? null;
      if (after != null && Math.abs(after - before) < 1e-6) {
        const next = [...sibs];
        next.splice(at + 1, 0, item);
        renumber(listId, next, { [itemId]: { parent_id: grandId } });
        return;
      }
      updateItem(listId, itemId, {
        parent_id: grandId,
        position: positionBetween(before, after),
      });
    },
    [getList, updateItem, renumber],
  );

  // Ticking a task that has sub-tasks ticks (or unticks) all of them; ticking a task
  // without sub-tasks just toggles it.
  const toggleItem = useCallback(
    (listId, itemId, completed) => {
      const list = getList(listId);
      if (!list?.items.some((i) => i.id === itemId)) return;
      if (!computeRollup(list.items).get(itemId)?.total)
        return updateItem(listId, itemId, { completed });
      const inBranch = new Set(subtreeIds(list.items, itemId));
      const ids = list.items
        .filter(
          (i) =>
            inBranch.has(i.id) && i.has_checkbox && i.completed !== completed,
        )
        .map((i) => i.id);
      if (!ids.length) return;
      dispatch({ type: "patchItems", listId, ids, patch: { completed } });
      persist(() => api.updateItems(ids, { completed }));
    },
    [dispatch, getList, persist, updateItem],
  );

  const clearCompleted = useCallback(
    (listId) => {
      const list = getList(listId);
      if (!list) return;
      const roll = computeRollup(list.items);
      const goneIds = new Set();
      for (const i of list.items)
        if (i.has_checkbox && roll.get(i.id).completed)
          for (const id of subtreeIds(list.items, i.id)) goneIds.add(id);
      const gone = list.items.filter((i) => goneIds.has(i.id));
      if (!gone.length) return;
      dispatch({ type: "removeItems", listId, ids: gone.map((i) => i.id) });
      persist(() => api.deleteItems(gone.map((i) => i.id)));
      toast({
        message: `Cleared ${gone.length} completed ${gone.length === 1 ? "item" : "items"}`,
        action: {
          label: "Undo",
          onClick: () => {
            dispatch({ type: "addItems", listId, items: gone });
            persist(() => api.insertItems(gone));
          },
        },
      });
    },
    [dispatch, getList, persist, toast],
  );

  // Plain-text items are never touched by bulk checkbox actions.
  const setAllCompleted = useCallback(
    (listId, completed) => {
      const list = getList(listId);
      const ids =
        list?.items
          .filter((i) => i.has_checkbox && i.completed !== completed)
          .map((i) => i.id) || [];
      if (!ids.length) return;
      dispatch({ type: "patchItems", listId, ids, patch: { completed } });
      persist(() => api.updateItems(ids, { completed }));
    },
    [dispatch, getList, persist],
  );

  const value = useMemo(
    () => ({
      status: state.status,
      error: state.error,
      lists: state.lists,
      templates: state.templates,
      reload,
      getList,
      createList,
      createListFromTemplate,
      addTemplateToList,
      saveTemplate,
      deleteTemplate,
      updateList,
      duplicateList,
      deleteList,
      moveList,
      setListArchived,
      undoArchive,
      addItem,
      updateItem,
      removeItem,
      moveItem,
      indentItem,
      outdentItem,
      toggleItem,
      clearCompleted,
      setAllCompleted,
      flushPending,
    }),
    [
      state,
      reload,
      getList,
      createList,
      createListFromTemplate,
      addTemplateToList,
      saveTemplate,
      deleteTemplate,
      updateList,
      duplicateList,
      deleteList,
      moveList,
      setListArchived,
      undoArchive,
      addItem,
      updateItem,
      removeItem,
      moveItem,
      indentItem,
      outdentItem,
      toggleItem,
      clearCompleted,
      setAllCompleted,
      flushPending,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
