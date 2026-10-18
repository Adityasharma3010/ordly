import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

// Splits a heading into words that slide up out of a mask. `scope` names the data attribute
// the animation looks for (data-hero="word", data-final="word", ...). Screen readers get the
// plain sentence; the animated pieces are hidden from them so words are not read apart.
export function Words({ text, scope }) {
  return (
    <>
      <span className="sr-only">{text} </span>
      <span aria-hidden>
        {text.split(" ").map((w, i, all) => (
          <span key={i}>
            <span className="inline-block overflow-hidden pb-[0.14em] align-bottom -mb-[0.14em]">
              <span {...{ [`data-${scope}`]: "word" }} className="inline-block">
                {w}
              </span>
            </span>
            {i < all.length - 1 && " "}
          </span>
        ))}
      </span>
    </>
  );
}

const cta =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap select-none " +
  "transition duration-150 active:scale-[0.97]";
export const ctaPrimary = `${cta} bg-accent text-on-accent shadow-sm hover:brightness-110`;
export const ctaGhost = `${cta} border border-line text-fg hover:border-line-strong hover:bg-surface`;
export const ctaSize = {
  md: "h-9 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

// "Get started" for visitors, "Open Ordly" for people who are signed in.
export function LandingCta({ size = "md", className = "" }) {
  const { user, status } = useAuth();
  const klass = `${ctaPrimary} ${ctaSize[size]} ${className}`;
  // Keep the space while we find out who is looking, so nothing jumps.
  if (status === "loading")
    return (
      <span aria-hidden className={`${klass} invisible`}>
        Get started
      </span>
    );
  return user ? (
    <Link to="/app" className={klass}>
      Open Ordly <ArrowRight className="size-4" aria-hidden />
    </Link>
  ) : (
    <Link to="/signup" className={klass}>
      Get started <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}
