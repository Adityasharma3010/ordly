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
import { nowIso, uid } from "../utils/format";
import {
  positionAtEnd,
  positionForMovedItem,
  sortByPosition,
  POSITION_STEP,
} from "../utils/position";

const WorkspaceContext = createContext(null);

const touch = (l) => ({ ...l, updated_at: nowIso() });

function reducer(state, a) {
  const mapList = (id, fn) => state.lists.map((l) => (l.id === id ? fn(l) : l));
  switch (a.type) {
    case "loaded":
      return { status: "ready", error: null, lists: a.lists };
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
    case "removeList":
      return { ...state, lists: state.lists.filter((l) => l.id !== a.id) };
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
const INITIAL = { status: "loading", error: null, lists: [] };

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
      const lists = await api.fetchWorkspace(userId);
      dispatch({ type: "loaded", lists });
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
    } = {}) => {
      const now = nowIso();
      const list = {
        id: uid(),
        owner_id: userId,
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
    [userId, persist, dispatch],
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

  const duplicateList = useCallback(
    (id) => {
      const src = getList(id);
      if (!src) return null;
      const now = nowIso();
      const copy = {
        id: uid(),
        owner_id: userId,
        title: `${src.title} (copy)`.slice(0, 200),
        description: src.description,
        icon: src.icon,
        color: src.color,
        favorite: false,
        archived: false,
        created_at: now,
        updated_at: now,
        role: "owner",
        items: [],
      };
      copy.items = sortByPosition(src.items).map((i) => ({
        ...i,
        id: uid(),
        list_id: copy.id,
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

  const deleteList = useCallback(
    (id) => {
      dispatch({ type: "removeList", id });
      persist(() => api.deleteList(id));
    },
    [dispatch, persist],
  );

  // ---------- Items ----------
  const addItem = useCallback(
    (listId, { text, has_checkbox = true }) => {
      const list = getList(listId);
      const clean = text.trim();
      if (!list || !clean) return null;
      const now = nowIso();
      const item = {
        id: uid(),
        list_id: listId,
        text: clean,
        notes: "",
        has_checkbox,
        completed: false,
        position: positionAtEnd(list.items),
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
      const item = getList(listId)?.items.find((i) => i.id === itemId);
      if (!item) return;
      const pending = timers.current.get(`item:${itemId}`);
      if (pending) {
        clearTimeout(pending.t);
        timers.current.delete(`item:${itemId}`);
      }
      dispatch({ type: "removeItems", listId, ids: [itemId] });
      persist(() => api.deleteItems([itemId]));
      toast({
        message: "Item deleted",
        action: {
          label: "Undo",
          onClick: () => {
            dispatch({ type: "addItems", listId, items: [item] });
            persist(() => api.insertItems([item]));
          },
        },
      });
    },
    [dispatch, getList, persist, toast],
  );

  const moveItem = useCallback(
    (listId, activeId, overId) => {
      const list = getList(listId);
      if (!list || activeId === overId) return;
      const ordered = sortByPosition(list.items);
      const from = ordered.findIndex((i) => i.id === activeId);
      const to = ordered.findIndex((i) => i.id === overId);
      if (from < 0 || to < 0) return;
      const next = [...ordered];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      let pos = positionForMovedItem(next, activeId);
      const before = next[to - 1]?.position;
      const after = next[to + 1]?.position;
      // Gaps can shrink after many moves; renumber the list when they get too small.
      if (before != null && after != null && Math.abs(after - before) < 1e-6) {
        const renumbered = next.map((i, idx) => ({
          id: i.id,
          position: (idx + 1) * POSITION_STEP,
        }));
        renumbered.forEach(({ id, position }) => {
          dispatch({
            type: "patchItem",
            listId,
            itemId: id,
            patch: { position },
          });
          persist(() => api.updateItem(id, { position }));
        });
        return;
      }
      if (pos == null) return;
      updateItem(listId, activeId, { position: pos });
    },
    [dispatch, getList, updateItem, persist],
  );

  const clearCompleted = useCallback(
    (listId) => {
      const list = getList(listId);
      const gone =
        list?.items.filter((i) => i.has_checkbox && i.completed) || [];
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
      reload,
      getList,
      createList,
      updateList,
      duplicateList,
      deleteList,
      addItem,
      updateItem,
      removeItem,
      moveItem,
      clearCompleted,
      setAllCompleted,
      flushPending,
    }),
    [
      state,
      reload,
      getList,
      createList,
      updateList,
      duplicateList,
      deleteList,
      addItem,
      updateItem,
      removeItem,
      moveItem,
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
