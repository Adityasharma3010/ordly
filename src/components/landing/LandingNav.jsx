import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { Logo } from "../ui/Logo";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { playNav, scrollToId } from "../../lib/landingMotion";
import { LandingCta, ctaGhost, ctaSize } from "./common";

export function LandingNav({ links }) {
  const ref = useRef(null);
  const { user, status } = useAuth();
  const { theme, toggle } = useTheme();
  const [solid, setSolid] = useState(false);

  useLayoutEffect(() => playNav(ref.current), []);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id) => (e) => {
    e.preventDefault();
    scrollToId(id);
  };

  return (
    <header
      ref={ref}
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        solid ? "border-line bg-bg/75 backdrop-blur-xl" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a
          href="#top"
          data-nav="item"
          onClick={go("top")}
          aria-label="Ordly, back to top"
          className="rounded-lg"
        >
          <Logo />
        </a>
        <nav
          aria-label="Page sections"
          className="hidden items-center gap-8 text-sm text-muted md:flex"
        >
          {links.map((l) => (
            <a
              key={l.id}
              data-nav="item"
              href={`#${l.id}`}
              onClick={go(l.id)}
              className="transition-colors hover:text-fg"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-nav="item"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            {theme === "dark" ? (
              <Sun className="size-[18px]" aria-hidden />
            ) : (
              <Moon className="size-[18px]" aria-hidden />
            )}
          </button>
          {status === "ready" && !user && (
            <span data-nav="item" className="hidden sm:inline-flex">
              <Link
                to="/login"
                className={`${ctaGhost} ${ctaSize.md} border-transparent`}
              >
                Sign in
              </Link>
            </span>
          )}
          <span data-nav="item">
            <LandingCta />
          </span>
        </div>
      </div>
      <div
        data-nav="progress"
        aria-hidden
        className="absolute inset-x-0 bottom-[-1px] h-px origin-left bg-accent"
        style={{ transform: "scaleX(0)" }}
      />
    </header>
  );
}
