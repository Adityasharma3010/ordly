import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { backendMode } from "../../services/api";
import { SaveIndicator } from "./SaveIndicator";

export function AppShell({ sidebar, header, children, mobileFooter, rootRef }) {
  const [collapsed, setCollapsed] = usePersistentState(
    "ordly.sidebar.collapsed",
    false,
  );
  const [drawerRequested, setDrawer] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const drawer = drawerRequested && !desktop; // the drawer never shows on desktop
  const close = () => setDrawer(false);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div ref={rootRef} className="flex h-dvh flex-col overflow-hidden">
      {backendMode === "local" && (
        <div className="shrink-0 border-b border-accent/25 bg-accent/10 px-4 py-1.5 text-center text-xs text-muted">
          <b className="font-medium text-fg">Local dev mode.</b> Data stays in
          this browser only. Add Supabase keys to enable accounts, sync and
          sharing.
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 64 : 280 }}
          transition={{ type: "spring", stiffness: 420, damping: 40 }}
          className="hidden shrink-0 overflow-hidden border-r border-line bg-surface/50 lg:block"
        >
          {sidebar({
            collapsed,
            mobile: false,
            onToggleCollapse: () => setCollapsed((c) => !c),
            onNavigate: () => {},
          })}
        </motion.aside>

        <AnimatePresence>
          {drawer && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div
                className="absolute inset-0 bg-black/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={close}
                aria-hidden
              />
              <motion.aside
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 420, damping: 42 }}
                className="absolute inset-y-0 left-0 w-[min(20rem,88vw)] border-r border-line bg-surface pt-[env(safe-area-inset-top)]"
              >
                <button
                  aria-label="Close navigation"
                  onClick={close}
                  className="absolute top-3 right-3 z-10 cursor-pointer rounded-lg p-1.5 text-faint hover:bg-raised hover:text-fg"
                >
                  <X className="size-4" />
                </button>
                {sidebar({
                  collapsed: false,
                  mobile: true,
                  onToggleCollapse: () => {},
                  onNavigate: close,
                })}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          {header({ openDrawer: () => setDrawer(true) })}
          <main
            id="main"
            className="scroll-thin min-h-0 flex-1 overflow-y-auto"
          >
            {children}
          </main>
          <div className="flex shrink-0 justify-center border-t border-line bg-surface py-1 sm:hidden">
            <SaveIndicator />
          </div>
          {mobileFooter}
        </div>
      </div>
    </div>
  );
}
