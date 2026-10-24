import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Eye, Pencil } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { api } from "../services/api";
import { Logo } from "../components/ui/Logo";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { Skeleton } from "../components/ui/Skeleton";
import { ProgressBar } from "../components/checklist/ProgressBar";
import { getStats } from "../utils/listStats";
import { buildRows } from "../utils/tree";
import { accentHex } from "../utils/appearance";
import { Notice, Splash } from "./NotFound";
import { timeAgo } from "../utils/format";
import { Markdown } from "../components/notes/Markdown";

const POLL_MS = 30000;

/**
 * /s/:token
 *  • Signed in  → redeem the link (becomes viewer/editor) and open it in the workspace.
 *  • Signed out → read-only public view; edit links ask the visitor to sign in first.
 * A revoked or expired link shows an explanation. The server (RLS + RPCs) enforces all of this.
 */
export default function SharedListPage() {
  const { token } = useParams();
  return <SharedList key={token} token={token} />;
}

function SharedList({ token }) {
  const { user, status } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [state, setState] = useState({
    phase: "loading",
    data: null,
    error: "",
  });

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setState({ phase: "loading", data: null, error: "" });
      try {
        const data = await api.getSharedList(token);
        setState(
          data
            ? { phase: "ready", data, error: "" }
            : { phase: "gone", data: null, error: "" },
        );
      } catch (e) {
        if (!silent) setState({ phase: "error", data: null, error: e.message });
      }
    },
    [token],
  );

  // Signed-in visitors join the list so it shows up under "Shared with me".
  useEffect(() => {
    if (status !== "ready") return;
    if (user && api.capabilities.sharing) {
      let alive = true;
      api
        .redeemShare(token)
        .then((res) => {
          if (alive) navigate(`/app/${res.list_id}`, { replace: true });
        })
        .catch((e) => {
          if (!alive) return;
          setState(
            /invalid_link|P0002/i.test(`${e.code} ${e.message}`)
              ? { phase: "gone", data: null, error: "" }
              : { phase: "error", data: null, error: e.message },
          );
        });
      return () => {
        alive = false;
      };
    }
    let alive = true;
    api
      .getSharedList(token)
      .then((data) => {
        if (alive)
          setState(
            data
              ? { phase: "ready", data, error: "" }
              : { phase: "gone", data: null, error: "" },
          );
      })
      .catch((e) => {
        if (alive) setState({ phase: "error", data: null, error: e.message });
      });
    return () => {
      alive = false;
    };
  }, [status, user, token, navigate]);

  // Anonymous viewers: notice revocation without a manual refresh.
  useEffect(() => {
    if (state.phase !== "ready") return;
    const t = setInterval(() => load(true), POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [state.phase, load]);

  const items = state.data?.items;
  const stats = useMemo(() => getStats(items || []), [items]);
  const rows = useMemo(() => buildRows(items || []), [items]);

  if (!api.capabilities.sharing) {
    return (
      <Notice
        title="Sharing isn’t set up"
        body="This copy of the app has no backend configured, so shared links can’t be opened."
      >
        <Link to="/" className="text-accent">
          Go home
        </Link>
      </Notice>
    );
  }
  const joining =
    status === "ready" &&
    user &&
    api.capabilities.sharing &&
    state.phase === "loading";
  if (status === "loading" || joining)
    return <Splash label="Opening shared list" />;
  if (state.phase === "gone") {
    return (
      <Notice
        title="This link isn’t available"
        body="The link may have been revoked, expired, or mistyped. Ask the owner for a new one."
      >
        <Link
          to="/"
          className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent"
        >
          Go to Ordly
        </Link>
      </Notice>
    );
  }
  if (state.phase === "error") {
    return (
      <Notice
        title="Couldn’t open the list"
        body={state.error || "Check your connection and try again."}
      >
        <Button variant="primary" onClick={() => load()}>
          Try again
        </Button>
      </Notice>
    );
  }
  if (state.phase === "loading") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-8">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-3" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const { list, permission, owner_name } = state.data;
  const canEdit = permission === "edit";
  const next = encodeURIComponent(`/s/${token}`);

  return (
    <div className="min-h-dvh" style={{ "--c-accent": accentHex(list.color) }}>
      <header className="flex h-14 items-center justify-between border-b border-line px-4 sm:px-8">
        <Link to="/" aria-label="Ordly home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={toggle}>
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
          <Link
            to={`/login?next=${next}`}
            className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent"
          >
            {canEdit ? "Sign in to edit" : "Sign in"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-8 pb-24 sm:px-8 sm:pt-12">
        <p
          className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-muted"
          role="status"
        >
          {canEdit ? (
            <Pencil className="size-3.5 text-accent" aria-hidden />
          ) : (
            <Eye className="size-3.5" aria-hidden />
          )}
          {canEdit ? (
            <span>
              {owner_name || "Someone"} invited you to edit this list.{" "}
              <Link
                className="text-accent underline"
                to={`/login?next=${next}`}
              >
                Sign in
              </Link>{" "}
              to make changes. Until then it’s read-only.
            </span>
          ) : (
            <span>
              {owner_name || "Someone"} shared this list with you (view only).
            </span>
          )}
        </p>

        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-2xl">
            {list.icon || <span className="size-3 rounded-full bg-accent" />}
          </span>
          <div>
            <h1 className="font-serif text-4xl leading-tight">{list.title}</h1>
            {list.description && (
              <p className="mt-1 text-sm text-muted">{list.description}</p>
            )}
            <p className="mt-1 text-xs text-faint">
              Updated {timeAgo(list.updated_at)}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-[13px] text-muted">
            {stats.total
              ? `${stats.done} of ${stats.total} tasks done`
              : "No tasks with checkboxes"}
          </p>
          <ProgressBar stats={stats} />
        </div>

        {items.length === 0 ? (
          <p className="mt-10 text-center text-muted">This list is empty.</p>
        ) : (
          <ul
            className="mt-6 space-y-1"
            aria-label="Shared checklist (read-only)"
          >
            {rows.map(({ item: i, depth, progress, completed }) => (
              <li
                key={i.id}
                style={{ marginLeft: Math.min(depth, 8) * 24 }}
                className="flex items-start gap-3 rounded-xl px-2 py-2"
              >
                <div className="mt-px grid h-6 shrink-0 place-items-center">
                  {i.has_checkbox ? (
                    <Checkbox
                      checked={completed}
                      disabled
                      onChange={() => {}}
                      label={`${i.text}: ${completed ? "completed" : "not completed"}`}
                    />
                  ) : (
                    <span
                      className="size-1.5 rounded-full bg-faint"
                      aria-hidden
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[15px] leading-6 break-words ${i.has_checkbox && completed ? "text-faint line-through" : i.has_checkbox ? "" : "text-muted"}`}
                  >
                    {i.text}
                    {progress && (
                      <span className="ml-2 align-middle text-xs text-faint tabular-nums">
                        {progress.done}/{progress.total}
                      </span>
                    )}
                  </p>
                  {i.notes && (
                    <Markdown text={i.notes} className="text-faint" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
