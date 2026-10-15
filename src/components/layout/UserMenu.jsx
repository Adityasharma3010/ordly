import { useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { Menu } from "../ui/Menu";
import { SettingsModal } from "./SettingsModal";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";

export function Avatar({ name, size = "size-8" }) {
  return (
    <span
      className={`${size} grid shrink-0 place-items-center rounded-full bg-accent/20 text-[13px] font-semibold text-accent uppercase`}
    >
      {(name || "?")[0]}
    </span>
  );
}

// variant "row" is the full-width sidebar footer; "avatar" is the compact header button.
export function UserMenu({
  variant = "avatar",
  collapsed = false,
  side = "bottom",
  align = "right",
}) {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState(false);
  return (
    <>
      <Menu
        side={side}
        align={align}
        width="w-56"
        trigger={({ ref, props }) =>
          variant === "row" ? (
            <button
              ref={ref}
              {...props}
              aria-label="Account menu"
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-raised"
            >
              <Avatar name={user?.name} />
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {user?.name}
                  </span>
                  <span className="block truncate text-xs text-faint">
                    {api.capabilities.auth ? user?.email : "Local dev mode"}
                  </span>
                </span>
              )}
            </button>
          ) : (
            <button
              ref={ref}
              {...props}
              aria-label="Account menu"
              className="cursor-pointer rounded-full transition active:scale-95"
            >
              <Avatar name={user?.name} />
            </button>
          )
        }
        items={[
          {
            label: "Settings",
            icon: Settings,
            onClick: () => setSettings(true),
          },
          ...(api.capabilities.auth
            ? [
                { divider: true },
                { label: "Sign out", icon: LogOut, onClick: signOut },
              ]
            : []),
        ]}
      />
      <SettingsModal open={settings} onClose={() => setSettings(false)} />
    </>
  );
}
