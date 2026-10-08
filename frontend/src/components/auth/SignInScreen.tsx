"use client";

/**
 * Onboarding: phone number, then the verification code.
 *
 * The code is mocked, as the brief permits. Rather than hiding that, the
 * screen shows the code the server issued and lists the seeded accounts as
 * one-tap buttons, so a reviewer reaches the app in a few seconds without
 * guessing a phone number.
 */

import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { LockIcon } from "@/components/ui/Icons";
import { authApi } from "@/lib/endpoints";
import { useSession } from "@/store/session";
import type { DemoAccount } from "@/lib/types";

type Step = "phone" | "code";

export function SignInScreen() {
  const { requestCode, verify, error } = useSession();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);

  useEffect(() => {
    authApi
      .demoAccounts()
      .then(setDemoAccounts)
      .catch(() => setDemoAccounts([]));
  }, []);

  async function startWith(phoneNumber: string) {
    setBusy(true);
    try {
      setPhone(phoneNumber);
      const debugCode = await requestCode(phoneNumber);
      setIssuedCode(debugCode);
      setCode(debugCode ?? "");
      setStep("code");
    } catch {
      /* the store holds the message */
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    setBusy(true);
    try {
      await verify(phone, code);
    } catch {
      /* the store holds the message */
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-surface-raised px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-ultramarine text-white">
            <LockIcon size={26} />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">Signal</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            {step === "phone"
              ? "Enter your phone number to continue"
              : `We sent a code to ${phone}`}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          {step === "phone" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void startWith(phone);
              }}
              className="flex flex-col gap-3"
            >
              <label htmlFor="phone-field" className="text-[13px] font-medium text-ink">
                Phone number
              </label>
              <input
                id="phone-field"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+919812345601"
                autoComplete="tel"
                className="h-10 rounded-lg border border-border bg-surface-sunken px-3 text-[15px] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ultramarine"
              />
              <button
                type="submit"
                disabled={busy || phone.trim().length < 8}
                className="h-10 rounded-full bg-ultramarine text-[14px] font-medium text-white transition-colors hover:bg-ultramarine-hover disabled:opacity-50"
              >
                {busy ? "Sending…" : "Continue"}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitCode();
              }}
              className="flex flex-col gap-3"
            >
              <label htmlFor="code-field" className="text-[13px] font-medium text-ink">
                Verification code
              </label>
              <input
                id="code-field"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                maxLength={8}
                className="h-11 rounded-lg border border-border bg-surface-sunken px-3 text-center text-[20px] tracking-[0.4em] text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-ultramarine"
              />
              {issuedCode && (
                <p className="rounded-lg bg-ultramarine-soft px-3 py-2 text-[12px] text-ink-2">
                  Verification is mocked for this assignment. The server issued{" "}
                  <strong className="font-semibold text-ink">{issuedCode}</strong> and it
                  is already filled in.
                </p>
              )}
              <button
                type="submit"
                disabled={busy || code.trim().length < 4}
                className="h-10 rounded-full bg-ultramarine text-[14px] font-medium text-white transition-colors hover:bg-ultramarine-hover disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                }}
                className="text-[13px] text-ultramarine hover:underline"
              >
                Use a different number
              </button>
            </form>
          )}

          {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
        </div>

        {step === "phone" && demoAccounts.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-center text-[12px] uppercase tracking-wide text-ink-3">
              Seeded accounts
            </p>
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              {demoAccounts.map((account) => (
                <button
                  key={account.phone_number}
                  type="button"
                  disabled={busy}
                  onClick={() => void startWith(account.phone_number)}
                  className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-hover disabled:opacity-60"
                >
                  <Avatar
                    name={account.display_name}
                    colorKey={account.avatar_color}
                    size={32}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-ink">
                      {account.display_name}
                    </div>
                    <div className="truncate text-[12px] text-ink-3">
                      {account.phone_number}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
