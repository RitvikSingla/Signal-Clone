"use client";

/**
 * Session state.
 *
 * The access token lives here in memory and is mirrored into the API client,
 * never into localStorage. Persistence across a refresh comes from the
 * httpOnly refresh cookie: on boot the app calls refresh once, and either
 * gets a new access token or learns that it is signed out.
 */

import { create } from "zustand";

import { ApiError, setAccessToken } from "@/lib/api";
import { authApi } from "@/lib/endpoints";
import type { UserPrivate } from "@/lib/types";

export type SessionStatus = "loading" | "authenticated" | "onboarding" | "anonymous";

type SessionState = {
  status: SessionStatus;
  user: UserPrivate | null;
  error: string | null;

  /** Called once on mount. Restores a session from the refresh cookie. */
  bootstrap: () => Promise<void>;
  requestCode: (phone: string) => Promise<string | null>;
  verify: (phone: string, code: string) => Promise<SessionStatus>;
  completeProfile: (payload: {
    display_name: string;
    username?: string | null;
    about?: string | null;
    avatar_color?: string | null;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  patchUser: (patch: Partial<UserPrivate>) => void;
};

export const useSession = create<SessionState>((set, get) => ({
  status: "loading",
  user: null,
  error: null,

  bootstrap: async () => {
    try {
      const { access_token } = await authApi.refresh();
      setAccessToken(access_token);
      const user = await authApi.me();
      set({
        user,
        // An account that verified a code but never finished the profile
        // step lands in onboarding rather than the app.
        status: user.display_name ? "authenticated" : "onboarding",
        error: null,
      });
    } catch {
      setAccessToken(null);
      set({ status: "anonymous", user: null });
    }
  },

  requestCode: async (phone) => {
    set({ error: null });
    try {
      const res = await authApi.requestCode(phone);
      return res.debug_code;
    } catch (error) {
      set({ error: error instanceof ApiError ? error.message : "Could not send a code." });
      throw error;
    }
  },

  verify: async (phone, code) => {
    set({ error: null });
    try {
      const res = await authApi.verify(phone, code);
      setAccessToken(res.access_token);
      const status: SessionStatus = res.is_registered ? "authenticated" : "onboarding";
      set({ user: res.user, status });
      return status;
    } catch (error) {
      set({ error: error instanceof ApiError ? error.message : "Could not sign in." });
      throw error;
    }
  },

  completeProfile: async (payload) => {
    const user = await authApi.register(payload);
    set({ user, status: "authenticated", error: null });
  },

  signOut: async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      set({ user: null, status: "anonymous", error: null });
    }
  },

  patchUser: (patch) => {
    const current = get().user;
    if (current) set({ user: { ...current, ...patch } });
  },
}));
