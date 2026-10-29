import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Link2, Mail, MailCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { Logo } from "../components/ui/Logo";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import { Splash } from "./NotFound";
import { playAuthIntro } from "../lib/animations";
import { savePendingNext } from "../utils/pendingNext";

// Only allow in-app redirects (blocks open-redirect via ?next=https://evil.example).
export const safeNext = (n) =>
  n && n.startsWith("/") && !n.startsWith("//") ? n : null;

const PREVIEW = [
  { t: "Book the venue", done: true },
  { t: "Send invitations", done: true },
  { t: "Order the cake", done: false },
  { t: "Notes: dietary needs → see Priya’s message", plain: true },
];

// Decorative; GSAP (lib/animations.js) plays the ticks. Rendered in its finished state so
// reduced-motion users, and the animation's own cleanup, land on the complete picture.
function Preview() {
  return (
    <div
      aria-hidden
      data-intro="card"
      className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-pop"
    >
      <p data-intro="card-title" className="font-serif text-2xl">
        🎉 Party planning
      </p>
      <div className="mt-3 h-1.5 rounded-full bg-raised">
        <div
          data-intro="bar"
          className="h-full rounded-full bg-accent"
          style={{ width: "66%" }}
        />
      </div>
      <ul className="mt-4 space-y-3">
        {PREVIEW.map((r) => (
          <li
            key={r.t}
            data-intro="row"
            data-done={r.done ? "true" : "false"}
            className={`preview-row flex items-center gap-3 text-[15px] ${r.done ? "is-done" : ""}`}
          >
            {r.plain ? (
              <span className="mx-2 size-1.5 rounded-full bg-faint" />
            ) : (
              <span
                className={`grid size-[22px] place-items-center rounded-md border-[1.5px] ${r.done ? "border-accent bg-accent/15" : "border-line-strong"}`}
              >
                {r.done && (
                  <svg viewBox="0 0 24 24" className="size-4" fill="none">
                    <path
                      data-intro="tick"
                      d="M4.5 12.8l4.6 4.7L19.8 5.6"
                      stroke="var(--c-accent)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            )}
            <span
              className={`preview-text ${r.plain ? "text-sm text-muted" : ""}`}
            >
              {r.t}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// "or" between the main button and the other ways in.
function OrDivider() {
  return (
    <div
      className="my-5 flex items-center gap-3 text-xs text-faint"
      aria-hidden
    >
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

const friendly = (msg = "") => {
  if (/invalid login/i.test(msg)) return "That email and password don’t match.";
  if (
    /token has expired|invalid.*(token|otp|code)|otp.*(expired|invalid)/i.test(
      msg,
    )
  )
    return "That code is wrong or has expired. Check it, or ask for a new one.";
  if (/only request this after|after \d+ seconds/i.test(msg))
    return "Please wait a minute before asking for another code.";
  if (/provider.*not enabled|unsupported provider/i.test(msg))
    return "Google sign-in isn’t switched on yet.";
  if (/already registered|already been registered/i.test(msg))
    return "An account with this email already exists. Try signing in.";
  if (/rate limit|too many/i.test(msg))
    return "Too many attempts. Please wait a minute and try again.";
  if (/fetch|network/i.test(msg))
    return "Can’t reach the server. Check your connection and try again.";
  return msg || "Something went wrong. Please try again.";
};

export default function AuthPage({ initialMode = "signin" }) {
  const { user, status, signIn, signUp, verifyCode, sessionExpired } =
    useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(initialMode); // signin | signup | forgot
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { kind: 'confirm' | 'reset', email }
  // Signing in goes one step at a time, like Google: email → (password | emailed code).
  const [step, setStep] = useState("email"); // email | method | code
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0); // seconds until another code may be sent
  const [googleOn, setGoogleOn] = useState(false);
  const next = safeNext(params.get("next"));
  const rootRef = useRef(null);
  const showing = status === "ready" && !user && api.capabilities.auth;
  useLayoutEffect(
    () => (showing ? playAuthIntro(rootRef.current) : undefined),
    [showing],
  );

  // Show "Continue with Google" only when it is switched on in the project.
  useEffect(() => {
    let alive = true;
    if (api.capabilities.auth && api.authProviders)
      api.authProviders().then((p) => alive && setGoogleOn(!!p?.google));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!api.capabilities.auth) return <Navigate to="/app" replace />;
  if (status === "loading") return <Splash />;
  if (user) return <Navigate to={next || "/app"} replace />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError("");
  };

  const goStep = (st) => {
    setStep(st);
    setError("");
    setInfo("");
  };
  const askForCode = async (resend = false) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await api.sendEmailCode(form.email.trim());
      setCooldown(60);
      if (resend) setInfo("A new code is on its way.");
      else {
        setCode("");
        setStep("code");
      }
    } catch (err) {
      setError(friendly(err.message));
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setBusy(true);
    setError("");
    try {
      // Google brings the person back to /app, so remember where they were headed.
      if (next) savePendingNext(next);
      await api.signInWithGoogle();
    } catch (err) {
      setError(friendly(err.message));
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const email = form.email.trim();
    const asking = mode === "signin" && step === "code";
    const needsPassword =
      mode === "signup" || (mode === "signin" && step === "method");
    if (!asking && !/^\S+@\S+\.\S+$/.test(email))
      return setError("Enter a valid email address.");
    if (mode === "signin" && step === "email") return goStep("method");
    if (needsPassword && form.password.length < 8)
      return setError("Use at least 8 characters for your password.");
    if (asking && !/^\d{6,10}$/.test(code))
      return setError("Enter the code from your email (digits only).");
    setBusy(true);
    setError("");
    try {
      if (asking) await verifyCode({ email, token: code });
      else if (mode === "signin")
        await signIn({ email, password: form.password });
      else if (mode === "signup") {
        const res = await signUp({
          email,
          password: form.password,
          name: form.name.trim(),
        });
        if (res.needsConfirmation) {
          // the confirmation link opens /app: remember where this person was headed
          if (next) savePendingNext(next);
          setDone({ kind: "confirm", email });
        }
      } else {
        await api.sendPasswordReset(email);
        setDone({ kind: "reset", email });
      }
    } catch (err) {
      setError(friendly(err.message));
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (m) => {
    setMode(m);
    setStep("email");
    setCode("");
    setError("");
    setInfo("");
    setDone(null);
  };
  const copy =
    mode === "signin"
      ? {
          email: ["Welcome back", "Continue"],
          method: ["Enter your password", "Sign in"],
          code: ["Check your email", "Verify code"],
        }[step]
      : {
          signup: ["Create your account", "Create account"],
          forgot: ["Reset your password", "Send reset link"],
        }[mode];
  const intro = {
    forgot: "Enter your email and we’ll send you a link.",
    method: "Sign in with your password, or get a code by email.",
    code: `We sent a code to ${form.email.trim()}. It only works for a short while.`,
  }[mode === "signin" ? step : mode];

  return (
    <div ref={rootRef} className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface/40 p-12 lg:flex">
        <div data-intro="logo">
          <Logo />
        </div>
        <div className="max-w-lg">
          <h1
            className="font-serif text-6xl leading-[1.02] tracking-tight"
            aria-label="Lists that stay put."
          >
            {["Lists", "that"].map((w) => (
              <span
                key={w}
                className="mr-[0.25em] inline-block overflow-hidden align-bottom"
              >
                <span data-intro="word" className="inline-block" aria-hidden>
                  {w}
                </span>
              </span>
            ))}
            {["stay", "put."].map((w) => (
              <span
                key={w}
                className="mr-[0.25em] inline-block overflow-hidden align-bottom"
              >
                <em
                  data-intro="word"
                  className="inline-block text-accent"
                  aria-hidden
                >
                  {w}
                </em>
              </span>
            ))}
          </h1>
          <p data-intro="lede" className="mt-5 max-w-md text-lg text-muted">
            Checklists you can trust: saved the instant you tick them, available
            on every device, and shareable with one link.
          </p>
          <ul className="mt-8 space-y-3 text-[15px] text-muted">
            <li data-intro="feature" className="flex items-center gap-3">
              <Sparkles className="size-4 text-accent" aria-hidden />
              Tasks with checkboxes, or plain notes, in the same list
            </li>
            <li data-intro="feature" className="flex items-center gap-3">
              <Link2 className="size-4 text-accent" aria-hidden />
              View-only or editable share links you can revoke
            </li>
            <li data-intro="feature" className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-accent" aria-hidden />
              Private by default, enforced in the database
            </li>
          </ul>
        </div>
        <Preview />
      </section>

      <main
        data-intro="panel"
        className="flex flex-col justify-center px-6 py-10 sm:px-12"
      >
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          {sessionExpired && !done && (
            <p
              role="status"
              className="mb-5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-[13px]"
            >
              Your session ended. Please sign in again.
            </p>
          )}
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="status"
              >
                <MailCheck className="mb-4 size-8 text-accent" aria-hidden />
                <h2 className="font-serif text-4xl">Check your inbox</h2>
                <p className="mt-2 text-muted">
                  {done.kind === "confirm"
                    ? "We sent a confirmation link to "
                    : "If an account exists for "}
                  <b className="text-fg">{done.email}</b>
                  {done.kind === "confirm"
                    ? ". Open it to finish creating your account, then sign in."
                    : ", a password reset link is on its way."}
                </p>
                <Button className="mt-6" onClick={() => switchTo("signin")}>
                  Back to sign in
                </Button>
              </motion.div>
            ) : (
              <motion.form
                key={`${mode}-${mode === "signin" ? step : ""}`}
                onSubmit={submit}
                noValidate
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <h2 className="font-serif text-4xl">{copy[0]}</h2>
                <p className="mt-1.5 mb-7 text-sm text-muted">
                  {intro ||
                    (next?.startsWith("/s/")
                      ? "Sign in to open the list that was shared with you."
                      : next?.startsWith("/app/")
                        ? "Sign in to open the list you were invited to."
                        : "Your lists, saved and synced.")}
                </p>
                <div className="space-y-4">
                  {mode === "signup" && (
                    <Input
                      label="Name"
                      value={form.name}
                      onChange={set("name")}
                      autoComplete="name"
                      placeholder="What should we call you?"
                    />
                  )}
                  {(mode !== "signin" || step === "email") && (
                    <Input
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      autoComplete="email"
                      autoFocus
                    />
                  )}
                  {mode === "signin" && step !== "email" && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-raised px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {form.email.trim()}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 cursor-pointer text-[13px] text-accent hover:underline"
                        onClick={() => goStep("email")}
                      >
                        Change
                      </button>
                    </div>
                  )}
                  {(mode === "signup" ||
                    (mode === "signin" && step === "method")) && (
                    <Input
                      label="Password"
                      type="password"
                      value={form.password}
                      onChange={set("password")}
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                      autoFocus={mode === "signin"}
                      hint={
                        mode === "signup" ? "At least 8 characters." : undefined
                      }
                    />
                  )}
                  {mode === "signin" && step === "code" && (
                    <Input
                      label="Sign-in code"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value.replace(/\D/g, ""));
                        setError("");
                        setInfo("");
                      }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={10}
                      placeholder="123456"
                      autoFocus
                    />
                  )}
                </div>
                {info && (
                  <p role="status" className="mt-4 text-[13px] text-muted">
                    {info}
                  </p>
                )}
                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger"
                  >
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={busy}
                  className="mt-6 w-full"
                >
                  {copy[1]}
                </Button>
                {mode === "signin" && step === "method" && (
                  <Button
                    type="button"
                    size="lg"
                    className="mt-3 w-full"
                    disabled={busy}
                    onClick={() => askForCode(false)}
                  >
                    <Mail className="size-4" aria-hidden />
                    Email me a sign-in code
                  </Button>
                )}
                {googleOn &&
                  (mode === "signup" ||
                    (mode === "signin" && step === "email")) && (
                    <>
                      <OrDivider />
                      <Button
                        type="button"
                        size="lg"
                        className="w-full"
                        disabled={busy}
                        onClick={google}
                      >
                        <GoogleLogo />
                        Continue with Google
                      </Button>
                    </>
                  )}
                <div className="mt-5 flex items-center justify-between gap-3 text-[13px] text-muted">
                  {mode === "signin" && step === "email" && (
                    <>
                      <span />
                      <button
                        type="button"
                        className="cursor-pointer text-accent hover:underline"
                        onClick={() => switchTo("signup")}
                      >
                        Create an account
                      </button>
                    </>
                  )}
                  {mode === "signin" && step === "method" && (
                    <button
                      type="button"
                      className="cursor-pointer hover:text-fg"
                      onClick={() => switchTo("forgot")}
                    >
                      Forgot password?
                    </button>
                  )}
                  {mode === "signin" && step === "code" && (
                    <>
                      <button
                        type="button"
                        className="cursor-pointer hover:text-fg disabled:cursor-default disabled:opacity-60"
                        disabled={cooldown > 0 || busy}
                        onClick={() => askForCode(true)}
                      >
                        {cooldown > 0
                          ? `Resend in ${cooldown}s`
                          : "Resend code"}
                      </button>
                      <button
                        type="button"
                        className="cursor-pointer text-accent hover:underline"
                        onClick={() => goStep("method")}
                      >
                        Use my password
                      </button>
                    </>
                  )}
                  {mode === "signup" && (
                    <button
                      type="button"
                      className="cursor-pointer hover:text-fg"
                      onClick={() => switchTo("signin")}
                    >
                      Already have an account?{" "}
                      <span className="text-accent">Sign in</span>
                    </button>
                  )}
                  {mode === "forgot" && (
                    <button
                      type="button"
                      className="cursor-pointer hover:text-fg"
                      onClick={() => switchTo("signin")}
                    >
                      ← Back to sign in
                    </button>
                  )}
                </div>
                {mode === "signin" && step === "method" && (
                  <p className="mt-4 text-xs text-faint">
                    New to Ordly? A code works for that too. It creates your
                    account.
                  </p>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
