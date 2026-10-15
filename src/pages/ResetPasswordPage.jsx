import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { api } from "../services/api";
import { Logo } from "../components/ui/Logo";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import { Notice, Splash } from "./NotFound";

// The emailed link signs the user in with a short-lived recovery session; here they set a new password.
export default function ResetPasswordPage() {
  const { user, status, setRecovering } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "loading") return <Splash />;
  if (!user) {
    return (
      <Notice
        title="Link expired"
        body="This password reset link is invalid or has expired. Request a new one from the sign-in page."
      >
        <Link
          to="/login"
          className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent"
        >
          Back to sign in
        </Link>
      </Notice>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) return setError("Use at least 8 characters.");
    if (pw !== pw2) return setError("Passwords don’t match.");
    setBusy(true);
    try {
      await api.updatePassword(pw);
      setRecovering(false);
      toast({ tone: "success", message: "Password updated" });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8">
          <Logo />
        </div>
        <h1 className="font-serif text-4xl">Choose a new password</h1>
        <div className="mt-6 space-y-4">
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError("");
            }}
            autoFocus
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => {
              setPw2(e.target.value);
              setError("");
            }}
          />
        </div>
        {error && (
          <p role="alert" className="mt-4 text-[13px] text-danger">
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
          Update password
        </Button>
      </form>
    </div>
  );
}
