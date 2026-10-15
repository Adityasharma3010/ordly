import { useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { api, backendMode } from "../../services/api";

const SHORTCUTS = [
  ["/", "Focus search"],
  ["Enter", "Add item / confirm"],
  ["Esc", "Close or cancel"],
  ["Space", "Pick up / drop a dragged item"],
];

export function SettingsModal({ open, onClose }) {
  const { user, renameUser, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || "");
  const [busy, setBusy] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === user.name) return;
    setBusy(true);
    try {
      await renameUser(name.trim());
      toast({ tone: "success", message: "Name updated" });
    } catch (err) {
      toast({ tone: "error", message: `Couldn’t update name: ${err.message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className="mt-2 space-y-6">
        {api.capabilities.auth && (
          <form onSubmit={saveName} className="space-y-3">
            <Input
              label="Display name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              hint={user?.email}
            />
            <Button
              type="submit"
              size="sm"
              loading={busy}
              disabled={!name.trim() || name.trim() === user?.name}
            >
              Save name
            </Button>
          </form>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Appearance</p>
            <p className="text-[13px] text-muted">
              {theme === "dark" ? "Dark" : "Light"} theme
            </p>
          </div>
          <Button onClick={toggle}>
            {theme === "dark" ? (
              <Sun className="size-4" aria-hidden />
            ) : (
              <Moon className="size-4" aria-hidden />
            )}
            Switch to {theme === "dark" ? "light" : "dark"}
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Keyboard shortcuts</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            {SHORTCUTS.map(([k, d]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 font-sans text-xs">
                    {k}
                  </kbd>
                </dt>
                <dd className="text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="rounded-lg bg-raised px-3 py-2 text-[13px] text-muted">
          Storage:{" "}
          {backendMode === "supabase"
            ? "Supabase (cloud, synced across devices)"
            : "this browser only (local dev mode)"}
        </p>

        {api.capabilities.auth && (
          <Button
            variant="danger"
            onClick={() => {
              onClose();
              signOut();
            }}
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        )}
      </div>
    </Modal>
  );
}
