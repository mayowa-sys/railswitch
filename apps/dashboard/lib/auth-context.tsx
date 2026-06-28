"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

// ---------- types ----------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  company: string;
  apiKey: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
}

const STORAGE_KEY = "railswitch_auth";
const MOCK_API_KEY = "sk_test_mockmerchanta";

function loadUserFromStorage(): AuthUser | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------- provider ----------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const user = loadUserFromStorage();
    return { user, isLoading: false };
  });

  const persist = useCallback((user: AuthUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setState({ user, isLoading: false });
  }, []);

  const login = useCallback(
    async (email: string, _password: string): Promise<AuthUser> => {
      void _password;
      // Mock mode — swap to POST /v1/auth/login when gateway auth is live.
      await new Promise((r) => setTimeout(r, 700));

      const mockUser: AuthUser = {
        id: `mer_${email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "_")}`,
        name: email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        email: email.toLowerCase(),
        company: `${email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Ltd`,
        apiKey: MOCK_API_KEY,
      };

      persist(mockUser);
      return mockUser;
    },
    [persist],
  );

  const signup = useCallback(
    async (name: string, email: string, _password: string): Promise<AuthUser> => {
      void _password;
      // Mock mode — swap to POST /v1/auth/register when gateway auth is live.
      await new Promise((r) => setTimeout(r, 900));

      const mockUser: AuthUser = {
        id: `mer_${Math.random().toString(36).slice(2, 10)}`,
        name,
        email: email.toLowerCase(),
        company: name,
        apiKey: MOCK_API_KEY,
      };

      persist(mockUser);
      return mockUser;
    },
    [persist],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, isLoading: false });
  }, []);

  const resetPassword = useCallback(async (_email: string): Promise<void> => {
    // Mock mode — always succeeds. Real mode calls POST /v1/auth/reset-password
    // with the email parameter. Until gateway auth is live, we simulate success.
    void _email;
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, signup, logout, resetPassword }),
    [state, login, signup, logout, resetPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------- hook ----------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
