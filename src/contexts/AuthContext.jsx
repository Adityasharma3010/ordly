import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready
  const [recovering, setRecovering] = useState(false); // arrived via password-reset email
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getUser()
      .then((u) => {
        if (alive) {
          setUser(u);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (alive) setStatus("ready");
      });

    const off = api.onAuthChange((event, u) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") {
        setUser((prev) => {
          if (prev) setSessionExpired(true);
          return null;
        });
        return;
      }
      if (u) {
        setUser(u);
        setSessionExpired(false);
      }
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  const signIn = useCallback(async (creds) => {
    const u = await api.signIn(creds);
    setUser(u);
    setSessionExpired(false);
    return u;
  }, []);
  const signUp = useCallback(async (data) => {
    const res = await api.signUp(data);
    if (!res.needsConfirmation) setUser(res.user);
    return res;
  }, []);
  const signOut = useCallback(async () => {
    await api.signOut();
    setUser(null);
    setSessionExpired(false);
  }, []);
  const renameUser = useCallback(
    async (name) => {
      await api.updateProfile(user.id, { name });
      setUser((u) => ({ ...u, name }));
    },
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      status,
      recovering,
      setRecovering,
      sessionExpired,
      signIn,
      signUp,
      signOut,
      renameUser,
    }),
    [
      user,
      status,
      recovering,
      sessionExpired,
      signIn,
      signUp,
      signOut,
      renameUser,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
