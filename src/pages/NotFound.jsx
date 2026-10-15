import { Link } from "react-router-dom";
import { Logo } from "../components/ui/Logo";

export function Splash({ label = "Loading…" }) {
  return (
    <div
      className="grid h-dvh place-items-center"
      role="status"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4">
        <Logo showName={false} />
        <div className="skeleton h-1.5 w-24" />
      </div>
    </div>
  );
}

export function Notice({ title, body, children }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="font-serif text-4xl">{title}</h1>
        <p className="mt-2 text-muted">{body}</p>
        <div className="mt-6 flex justify-center gap-2">{children}</div>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <Notice title="Page not found" body="That page doesn’t exist.">
      <Link
        to="/"
        className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent"
      >
        Go home
      </Link>
    </Notice>
  );
}
