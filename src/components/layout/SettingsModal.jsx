import { useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../../contexts/ToastContext";
import { api, backendMode } from "../../services/api";
import { Collapse } from "../ui/Collapse";
import { ColorField } from "../ui/ColorField";
import { ACCENTS } from "../../utils/appearance";
import { isHardToSee } from "../../utils/color";

// Where the custom colour starts when you first choose it.
const CUSTOM_START = "#4f8cff";

const SHORTCUTS = [
  ["/", "Focus search"],
  ["Enter", "Add item / confirm"],
  ["Esc", "Close or cancel"],
  ["Space", "Pick up / drop a dragged item"],
];

export function SettingsModal({ open, onClose }) {
  const { user, renameUser, signOut } = useAuth();
  const { theme, toggle, accentColor, setAccentColor } = useTheme();
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

        <fieldset className="min-w-0">
          <legend className="text-sm font-medium">Accent colour</legend>
          <p className="mt-0.5 mb-2 text-[13px] text-muted">
            The colour of buttons, highlights and ticks. Kept on this device.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ["default", "Ordly amber", ACCENTS.amber],
              ["custom", "Custom colour", accentColor],
            ].map(([key, label, swatch]) => {
              const on = (key === "custom") === !!accentColor;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setAccentColor(
                      key === "default" ? null : accentColor || CUSTOM_START,
                    )
                  }
                  className={`flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-left text-[13px] transition-colors ${on ? "border-accent bg-accent/10 text-fg" : "border-line bg-raised text-muted hover:border-line-strong hover:text-fg"}`}
                >
                  <span
                    className="size-6 shrink-0 rounded-full border border-black/20"
                    style={{
                      background:
                        swatch ||
                        "conic-gradient(#f66, #fd5, #6e6, #5df, #86f, #f6c, #f66)",
                    }}
                    aria-hidden
                  />
                  {label}
                </button>
              );
            })}
          </div>
          <Collapse open={!!accentColor} id="accent-custom">
            <div className="pt-3">
              {accentColor && (
                <ColorField
                  value={accentColor}
                  onChange={setAccentColor}
                  presets={Object.values(ACCENTS)}
                />
              )}
              {accentColor && isHardToSee(accentColor, theme) && (
                <p role="status" className="mt-2 text-xs text-danger">
                  That colour is hard to see on the {theme} theme. A{" "}
                  {theme === "dark" ? "lighter" : "darker"} one will work
                  better.
                </p>
              )}
            </div>
          </Collapse>
          <p className="mt-2 text-xs text-muted">
            Want to match your computer’s accent colour? Use “Pick from screen”
            (Chrome and Edge) and click a spot that has it, like the Windows
            taskbar or the Start menu. The colour stays fixed; it won’t change
            if you change it in Windows later.
          </p>
        </fieldset>

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
