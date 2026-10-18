import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const SharedListPage = lazy(() => import("./pages/SharedListPage"));
import WorkspacePage from "./pages/WorkspacePage";
import NotFound, { Splash } from "./pages/NotFound";

function RequireAuth() {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Splash />;
  if (!user)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage initialMode="signup" />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/s/:token" element={<SharedListPage />} />
        <Route path="/app" element={<RequireAuth />}>
          <Route path=":listId?" element={<WorkspacePage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
