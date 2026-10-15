import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  Globe,
  Link2Off,
  Lock,
  Pencil,
  RefreshCw,
  UserMinus,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button, IconButton } from "../ui/Button";
import { Switch } from "../ui/Switch";
import { Skeleton } from "../ui/Skeleton";
import { api } from "../../services/api";
import { useToast } from "../../contexts/ToastContext";

const LEVELS = [
  {
    key: "view",
    title: "Anyone with the link can view",
    hint: "No account needed. Read-only.",
    icon: Eye,
  },
  {
    key: "edit",
    title: "Anyone with the link can edit",
    hint: "Recipients must sign in, then can add, check off and edit items.",
    icon: Pencil,
  },
];

const urlFor = (token) => `${window.location.origin}/s/${token}`;

export function ShareModal({ open, onClose, list }) {
  const { toast } = useToast();
  const [state, setState] = useState({
    loading: true,
    error: "",
    shares: [],
    people: [],
  });
  const [busy, setBusy] = useState(""); // key of the row being changed
  const [copied, setCopied] = useState("");
  const inputs = useRef({});

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const [shares, people] = await Promise.all([
        api.listShares(list.id),
        api.collaborators(list.id),
      ]);
      setState({ loading: false, error: "", shares, people });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [list.id]);

  useEffect(() => {
    if (open && api.capabilities.sharing) load();
  }, [open, load]);

  const shareFor = (key) => state.shares.find((s) => s.permission === key);

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      await fn();
      await load();
      if (okMsg) toast({ tone: "success", message: okMsg });
    } catch (e) {
      toast({
        tone: "error",
        message: `Couldn’t update sharing: ${e.message}`,
      });
    } finally {
      setBusy("");
    }
  };

  const toggle = (key, on) =>
    run(
      key,
      () =>
        on ? api.createShare(list.id, key) : api.revokeShare(shareFor(key).id),
      on ? "Link created" : "Link revoked. It no longer works.",
    );
  const regenerate = (key) =>
    run(
      key,
      async () => {
        await api.revokeShare(shareFor(key).id);
        await api.createShare(list.id, key);
      },
      "New link created. The old one no longer works.",
    );

  const copy = async (key, url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = inputs.current[key];
      try {
        el?.focus();
        el?.select();
        if (!document.execCommand("copy")) throw new Error("copy failed");
      } catch {
        toast({
          tone: "error",
          message:
            "Couldn’t copy automatically. The link is selected: press Ctrl/Cmd+C.",
        });
        el?.select();
        return;
      }
    }
    setCopied(key);
    setTimeout(() => setCopied(""), 1800);
    toast({ tone: "success", message: "Link copied" });
  };

  const removePerson = (p) =>
    run(
      `p-${p.user_id}`,
      () => api.removeMember(list.id, p.user_id),
      `${p.display_name || "Person"} removed`,
    );

  const isShared = state.shares.length > 0 || state.people.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Share “${list.title}”`}
      size="md"
      description={
        api.capabilities.sharing
          ? undefined
          : "Sharing needs a Supabase backend."
      }
    >
      {!api.capabilities.sharing ? (
        <div className="mt-3 flex gap-3 rounded-xl border border-line bg-raised p-4 text-sm">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-accent"
            aria-hidden
          />
          <div className="space-y-2 text-muted">
            <p>
              This app is running in local dev mode, so your lists live only in
              this browser and can’t be shared.
            </p>
            <p>
              To enable sharing: create a Supabase project, run{" "}
              <code className="rounded bg-surface px-1">
                supabase/schema.sql
              </code>
              , add the keys to{" "}
              <code className="rounded bg-surface px-1">.env.local</code> and
              restart. The README walks through it.
            </p>
          </div>
        </div>
      ) : state.loading && !state.shares.length ? (
        <div className="mt-3 space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : state.error ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm"
        >
          <p className="text-danger">
            Couldn’t load sharing settings: {state.error}
          </p>
          <Button className="mt-3" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="mt-2 space-y-4">
          <p className="flex items-center gap-2 text-sm text-muted">
            {isShared ? (
              <Globe className="size-4 text-accent" aria-hidden />
            ) : (
              <Lock className="size-4" aria-hidden />
            )}
            <span>
              <b className="font-medium text-fg">
                {isShared ? "Shared" : "Private"}
              </b>
              {isShared ? "" : " · only you can open this list"}
            </span>
          </p>

          {LEVELS.map(({ key, title, hint, icon: Icon }) => {
            const share = shareFor(key);
            return (
              <div key={key} className="rounded-xl border border-line p-3.5">
                <div className="flex items-start gap-3">
                  <Icon
                    className="mt-0.5 size-4 shrink-0 text-muted"
                    aria-hidden
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-[13px] text-muted">{hint}</p>
                  </div>
                  <Switch
                    checked={!!share}
                    disabled={busy === key}
                    label={title}
                    onChange={(on) => toggle(key, on)}
                  />
                </div>
                {share && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      ref={(el) => {
                        inputs.current[key] = el;
                      }}
                      readOnly
                      value={urlFor(share.token)}
                      aria-label={`${key} link`}
                      onFocus={(e) => e.target.select()}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-raised px-3 text-[13px] text-muted focus:border-accent focus:outline-none"
                    />
                    <Button
                      size="sm"
                      onClick={() => copy(key, urlFor(share.token))}
                    >
                      {copied === key ? (
                        <Check className="size-3.5 text-ok" aria-hidden />
                      ) : (
                        <Copy className="size-3.5" aria-hidden />
                      )}
                      {copied === key ? "Copied" : "Copy"}
                    </Button>
                    <IconButton
                      label="Replace link (old link stops working)"
                      disabled={busy === key}
                      onClick={() => regenerate(key)}
                    >
                      <RefreshCw className="size-4" />
                    </IconButton>
                  </div>
                )}
              </div>
            );
          })}

          <div>
            <h3 className="mb-2 text-[13px] font-medium text-muted">
              People with access
            </h3>
            {state.people.length === 0 ? (
              <p className="rounded-lg bg-raised px-3 py-2.5 text-[13px] text-faint">
                Nobody has joined yet. People appear here after they open a link
                while signed in.
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {state.people.map((p) => (
                  <li
                    key={p.user_id}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-raised text-xs font-medium uppercase">
                      {(p.display_name || "?")[0]}
                    </span>
                    <span className="flex-1 truncate text-sm">
                      {p.display_name || "Unnamed user"}
                    </span>
                    <span className="rounded bg-raised px-1.5 py-0.5 text-xs text-muted">
                      {p.role === "editor" ? "Can edit" : "Can view"}
                    </span>
                    <IconButton
                      size="sm"
                      label={`Remove ${p.display_name || "person"}`}
                      disabled={busy === `p-${p.user_id}`}
                      onClick={() => removePerson(p)}
                    >
                      <UserMinus className="size-4" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="flex items-start gap-2 text-xs text-faint">
            <Link2Off className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Turning a link off revokes it immediately and removes everyone who
            joined through it.
          </p>
        </div>
      )}
    </Modal>
  );
}
