import { useLayoutEffect, useRef, useState } from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Plus, Sparkles, TriangleAlert } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";
import { ListWorkspace } from "../components/lists/ListWorkspace";
import { ListFormModal } from "../components/lists/ListFormModal";
import { ShareModal } from "../components/sharing/ShareModal";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { listsForView, VIEWS } from "../utils/listStats";
import { playWorkspaceIntro } from "../lib/animations";

const SAMPLE = [
  ["Add your first task above and press Enter", true],
  ["Tick me: progress updates instantly", true],
  ["Drag the handle on the left to reorder", true],
  [
    "Plain text items like this one have no checkbox and don’t count toward progress",
    false,
  ],
  ["Use the ⋯ menu on an item to add notes or toggle its checkbox", true],
];

function Panel({ icon: Icon, title, body, children }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <Icon className="mb-4 size-8 text-accent" aria-hidden />
      <h1 className="font-serif text-4xl">{title}</h1>
      <p className="mt-2 text-muted">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
    </div>
  );
}

export default function WorkspacePage() {
  const { listId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const ws = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const view = VIEWS[params.get("view")] ? params.get("view") : "all";
  const q = params.get("q") || "";
  const list = listId ? ws.lists.find((l) => l.id === listId) : null;

  // One-time staggered entrance, once the first list is on screen.
  const shellRef = useRef(null);
  const introReady = ws.status === "ready" && (ws.lists.length === 0 || !!list);
  useLayoutEffect(() => {
    if (introReady) playWorkspaceIntro(shellRef.current);
  }, [introReady]);

  const open = (id, query = "") =>
    navigate(
      `/app/${id}?view=${view}${query ? `&q=${encodeURIComponent(query)}` : ""}`,
    );
  const setView = (v) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set("view", v);
        n.delete("q");
        return n;
      },
      { replace: true },
    );

  const createList = (values) => {
    const id = ws.createList(values);
    navigate(`/app/${id}?view=all`);
  };
  const createSample = () => {
    const id = ws.createList({
      title: "Welcome to Ordly",
      icon: "👋",
      description: "A sample list. Edit or delete anything.",
      color: "amber",
    });
    SAMPLE.forEach(([text, has_checkbox]) =>
      ws.addItem(id, { text, has_checkbox }),
    );
    navigate(`/app/${id}?view=all`);
  };

  const sidebar = ({ collapsed, mobile, onToggleCollapse, onNavigate }) => (
    <Sidebar
      lists={ws.lists}
      view={view}
      onView={setView}
      activeId={listId}
      collapsed={collapsed}
      mobile={mobile}
      onToggleCollapse={onToggleCollapse}
      onSelect={(id) => {
        open(id);
        onNavigate();
      }}
      onCreate={() => {
        setCreateOpen(true);
        onNavigate();
      }}
    />
  );
  const header = ({ openDrawer }) => (
    <Header
      lists={ws.lists}
      onOpenList={open}
      onOpenMenu={openDrawer}
      canShare={list?.role === "owner"}
      onShare={() => setShareOpen(true)}
    />
  );

  let body;
  if (ws.status === "loading") {
    body = (
      <div
        className="mx-auto max-w-3xl space-y-4 px-8 pt-10"
        role="status"
        aria-label="Loading your lists"
      >
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-6 h-1.5" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  } else if (ws.status === "error") {
    body = (
      <Panel
        icon={TriangleAlert}
        title="Couldn’t load your lists"
        body={ws.error || "Something went wrong talking to the server."}
      >
        <Button variant="primary" onClick={ws.reload}>
          Try again
        </Button>
      </Panel>
    );
  } else if (ws.lists.length === 0) {
    body = (
      <Panel
        icon={Sparkles}
        title="Make your first list"
        body="Lists can mix checkbox tasks with plain notes, and be shared with a link."
      >
        <Button variant="primary" size="lg" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          New list
        </Button>
        <Button size="lg" onClick={createSample}>
          Start with a sample
        </Button>
      </Panel>
    );
  } else if (!listId) {
    const target =
      listsForView(ws.lists, view)[0] ||
      ws.lists.find((l) => !l.archived) ||
      ws.lists[0];
    return <Navigate to={`/app/${target.id}?view=${view}`} replace />;
  } else if (!list) {
    body = (
      <Panel
        icon={TriangleAlert}
        title="List not found"
        body="It may have been deleted, or you might not have access to it."
      >
        <Button variant="primary" onClick={() => navigate("/app")}>
          Back to your lists
        </Button>
      </Panel>
    );
  } else {
    body = <ListWorkspace key={`${list.id}|${q}`} list={list} />;
  }

  return (
    <>
      <AppShell rootRef={shellRef} sidebar={sidebar} header={header}>
        {body}
      </AppShell>
      <ListFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createList}
      />
      {list?.role === "owner" && (
        <ShareModal
          open={shareOpen}
          list={list}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
