/**
 * Auth store — Zustand
 * Manages authentication state, tokens, and user profile.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import api from "@/services/api";

interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  email_verified: boolean;
  totp_enabled: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (email: string, password: string, totpCode?: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
  fetchProfile: () => Promise<void>;
  setTokens: (access: string, refresh: string) => void;
}

interface RegisterData {
  full_name: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setTokens: (access, refresh) => {
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true });
        localStorage.setItem("access_token", access);
      },

      login: async (email, password, totpCode) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post("/auth/login", {
            email,
            password,
            totp_code: totpCode,
          });
          get().setTokens(data.access_token, data.refresh_token);
          await get().fetchProfile();
        } finally {
          set({ isLoading: false });
        }
      },

      loginWithGoogle: async (idToken) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post("/auth/google", { id_token: idToken });
          get().setTokens(data.access_token, data.refresh_token);
          await get().fetchProfile();
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          await api.post("/auth/register", data);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;
        try {
          const { data } = await api.post("/auth/refresh", {
            refresh_token: refreshToken,
          });
          get().setTokens(data.access_token, data.refresh_token);
          return true;
        } catch {
          get().logout();
          return false;
        }
      },

      fetchProfile: async () => {
        try {
          const { data } = await api.get("/users/me");
          set({ user: data });
        } catch {
          // Token might be invalid
        }
      },
    }),
    {
      name: "kalie-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
      }),
    }
  )
);
