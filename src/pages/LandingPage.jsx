import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/ui/Logo";
import { useAuth } from "../contexts/AuthContext";
import { FeatureBento } from "../components/landing/FeatureBento";
import { FinalCta } from "../components/landing/FinalCta";
import { Hero } from "../components/landing/Hero";
import { LandingNav } from "../components/landing/LandingNav";
import { ShareShowcase } from "../components/landing/ShareShowcase";
import { StoryPin } from "../components/landing/StoryPin";
import { UseCaseMarquee } from "../components/landing/UseCaseMarquee";
import { refreshWhenFontsLoad } from "../lib/landingMotion";

// While you decide which sections to keep: set one to false (or delete its line) and it
// disappears, along with its link in the top bar. The hero and the closing call to action
// always stay.
const SECTIONS = {
  marquee: true, // the scrolling ribbon of things people make lists for
  story: true, // "Capture. Nest. Share.": a pinned scroll story
  features: true, // parallax feature cards
  sharing: true, // the share window, animated
};

const NAV_LINKS = [
  { id: "story", label: "How it works", on: SECTIONS.story },
  { id: "features", label: "Features", on: SECTIONS.features },
  { id: "sharing", label: "Sharing", on: SECTIONS.sharing },
].filter((l) => l.on);

export default function LandingPage() {
  const { user, status } = useAuth();

  useEffect(() => {
    refreshWhenFontsLoad();
  }, []);

  return (
    <div className="relative bg-bg text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <LandingNav links={NAV_LINKS} />
      <main id="main">
        <Hero />
        {SECTIONS.marquee && <UseCaseMarquee />}
        {SECTIONS.story && <StoryPin />}
        {SECTIONS.features && <FeatureBento />}
        {SECTIONS.sharing && <ShareShowcase />}
        <FinalCta />
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted">
          <div className="flex items-center gap-3">
            <Logo />
            <span>Lists that stay put.</span>
          </div>
          <nav aria-label="Footer" className="flex items-center gap-6">
            {status === "ready" &&
              (user ? (
                <Link to="/app" className="hover:text-fg">
                  Open Ordly
                </Link>
              ) : (
                <>
                  <Link to="/login" className="hover:text-fg">
                    Sign in
                  </Link>
                  <Link to="/signup" className="hover:text-fg">
                    Get started
                  </Link>
                </>
              ))}
          </nav>
          <p>© {new Date().getFullYear()} Ordly</p>
        </div>
      </footer>
    </div>
  );
}
