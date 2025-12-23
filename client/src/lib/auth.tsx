import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  email: string;
  nome: string;
  tenantId: string | null;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isTenantAdmin: boolean;
  tenantId: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, nome: string, nomeFranquia: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

async function loginUser(email: string, password: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erro ao fazer login");
  }
  return res.json();
}

async function registerUser(email: string, password: string, nome: string, nomeFranquia: string): Promise<AuthUser> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, nome, nomeFranquia }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Erro ao criar conta");
  }
  return res.json();
}

async function logoutUser(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ["auth-user"],
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginUser(email, password),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth-user"], data);
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password, nome, nomeFranquia }: { email: string; password: string; nome: string; nomeFranquia: string }) =>
      registerUser(email, password, nome, nomeFranquia),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth-user"], data);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(["auth-user"], null);
      queryClient.clear();
    },
  });

  const login = async (email: string, password: string) => {
    return loginMutation.mutateAsync({ email, password });
  };

  const register = async (email: string, password: string, nome: string, nomeFranquia: string) => {
    return registerMutation.mutateAsync({ email, password, nome, nomeFranquia });
  };

  const logout = async () => {
    return logoutMutation.mutateAsync();
  };

  const refetchUser = async () => {
    await refetch();
  };

  const isSuperAdmin = user?.role === "super_admin";
  const isTenantAdmin = user?.role === "tenant_admin";
  const isAdmin = isSuperAdmin || isTenantAdmin || user?.role === "admin";

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated: !!user,
        isAdmin,
        isSuperAdmin,
        isTenantAdmin,
        tenantId: user?.tenantId ?? null,
        login,
        register,
        logout,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
