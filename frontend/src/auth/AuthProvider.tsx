import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { googleLogout } from "@react-oauth/google";
import { ApiError } from "../api/client";
import { api } from "../api/endpoints";
import type { User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  linkRequired: boolean;
  isWorking: boolean;
  error: string | null;
  signInWithGoogle: (credential: string) => Promise<void>;
  completeAccountLink: (username: string, password: string) => Promise<void>;
  cancelAccountLink: () => void;
  signOut: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [linkRequired, setLinkRequired] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingCredential = useRef<string | null>(null);

  const exchangeCredential = useCallback(
    async (credential: string, link?: { username: string; password: string }) => {
      const tokenResponse = await api.googleLogin(credential, link);
      const currentUser = await api.currentUser(tokenResponse.access_token);
      setAccessToken(tokenResponse.access_token);
      setUser(currentUser);
      setLinkRequired(false);
      pendingCredential.current = null;
    },
    [],
  );

  const signInWithGoogle = useCallback(
    async (credential: string) => {
      setError(null);
      setIsWorking(true);
      try {
        await exchangeCredential(credential);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 428) {
          pendingCredential.current = credential;
          setLinkRequired(true);
        } else {
          setError(caught instanceof Error ? caught.message : "No se pudo iniciar sesión.");
        }
      } finally {
        setIsWorking(false);
      }
    },
    [exchangeCredential],
  );

  const completeAccountLink = useCallback(
    async (username: string, password: string) => {
      const credential = pendingCredential.current;
      if (!credential) {
        setLinkRequired(false);
        setError("La verificación de Google expiró. Inicia sesión de nuevo.");
        return;
      }
      setError(null);
      setIsWorking(true);
      try {
        await exchangeCredential(credential, { username, password });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo vincular la cuenta.");
      } finally {
        setIsWorking(false);
      }
    },
    [exchangeCredential],
  );

  const cancelAccountLink = useCallback(() => {
    pendingCredential.current = null;
    setLinkRequired(false);
    setError(null);
  }, []);

  const signOut = useCallback(() => {
    pendingCredential.current = null;
    setAccessToken(null);
    setUser(null);
    setLinkRequired(false);
    setError(null);
    googleLogout();
  }, []);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      linkRequired,
      isWorking,
      error,
      signInWithGoogle,
      completeAccountLink,
      cancelAccountLink,
      signOut,
      clearError: () => setError(null),
    }),
    [user, accessToken, linkRequired, isWorking, error, signInWithGoogle, completeAccountLink, cancelAccountLink, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return value;
}
