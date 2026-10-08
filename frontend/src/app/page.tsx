"use client";

/**
 * Application entry.
 *
 * Decides between the sign-in screen, the profile step and the app itself,
 * based on the session the client can restore from the refresh cookie.
 */

import { useEffect } from "react";

import { ProfileSetup } from "@/components/auth/ProfileSetup";
import { SignInScreen } from "@/components/auth/SignInScreen";
import { SignalApp } from "@/components/shell/SignalApp";
import { ToastStack } from "@/components/ui/Toasts";
import { restoreTheme } from "@/lib/theme";
import { useSession } from "@/store/session";

export default function Home() {
  const { status, user, bootstrap } = useSession();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    // Re-apply a saved theme choice after a refresh.
    restoreTheme();
  }, []);

  return (
    <>
      {status === "loading" && <Splash />}
      {status === "anonymous" && <SignInScreen />}
      {status === "onboarding" && <ProfileSetup />}
      {status === "authenticated" && user && <SignalApp user={user} />}
      <ToastStack />
    </>
  );
}

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-raised">
      <div className="flex flex-col items-center gap-3">
        <div className="size-9 animate-spin rounded-full border-2 border-border border-t-ultramarine" />
        <p className="text-[13px] text-ink-3">Loading Signal…</p>
      </div>
    </div>
  );
}
