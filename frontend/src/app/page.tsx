"use client";

/**
 * Phase 0 scaffold check.
 *
 * Temporary. This route becomes the conversation shell in Phase 5. It exists
 * now so the phase gate is observable rather than asserted: if the backend is
 * reachable through the typed client, this page says so.
 */

import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { config } from "@/lib/config";
import type { HealthResponse, PingResponse } from "@/lib/types";

type Probe = {
  label: string;
  path: string;
  run: () => Promise<{ version: string; environment: string }>;
};

type ProbeState =
  | { kind: "pending" }
  | { kind: "ok"; version: string; environment: string }
  | { kind: "failed"; message: string };

const probes: Probe[] = [
  {
    label: "Liveness",
    path: "/health",
    run: async () => {
      const r = await api.get<HealthResponse>("/health", { absolutePath: true });
      return { version: r.version, environment: r.environment };
    },
  },
  {
    label: "Versioned API",
    path: `${config.apiPrefix}/ping`,
    run: async () => {
      const r = await api.get<PingResponse>("/ping");
      return { version: r.version, environment: r.environment };
    },
  },
];

export default function ScaffoldCheck() {
  const [states, setStates] = useState<ProbeState[]>(probes.map(() => ({ kind: "pending" })));
  const [checking, setChecking] = useState(false);

  const runAll = useCallback(async () => {
    setChecking(true);
    setStates(probes.map(() => ({ kind: "pending" })));
    const results = await Promise.all(
      probes.map(async (probe): Promise<ProbeState> => {
        try {
          const { version, environment } = await probe.run();
          return { kind: "ok", version, environment };
        } catch (error) {
          const message =
            error instanceof ApiError ? error.message : "Unexpected client error";
          return { kind: "failed", message };
        }
      }),
    );
    setStates(results);
    setChecking(false);
  }, []);

  useEffect(() => {
    void runAll();
  }, [runAll]);

  const allOk = states.every((s) => s.kind === "ok");
  const anyFailed = states.some((s) => s.kind === "failed");

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-8 px-5 py-16">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
          Signal Clone &middot; Phase 0
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Scaffold check</h1>
        <p className="max-w-prose text-sm leading-relaxed text-ink-2">
          This page is temporary. It confirms the browser reaches the backend through
          the typed API client, which is the gate for Phase 0. The conversation shell
          replaces it in Phase 5.
        </p>
      </header>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {probes.map((probe, i) => (
          <ProbeRow key={probe.path} label={probe.label} path={probe.path} state={states[i]} />
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runAll()}
          disabled={checking}
          className="rounded-full bg-ultramarine px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-ultramarine-hover disabled:opacity-60"
        >
          {checking ? "Checking…" : "Run again"}
        </button>
        <span className="text-xs text-ink-3">{config.apiUrl}</span>
      </div>

      {anyFailed && (
        <p className="rounded-lg border-l-2 border-danger bg-surface-raised px-4 py-3 text-sm text-ink-2">
          Start the backend with{" "}
          <code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs">
            uvicorn app.main:app --reload --port 8000
          </code>{" "}
          from the backend folder, then run the check again.
        </p>
      )}

      {allOk && (
        <p className="rounded-lg border-l-2 border-success bg-surface-raised px-4 py-3 text-sm text-ink-2">
          Phase 0 gate passed. Both dev servers are up and the API client works.
        </p>
      )}
    </main>
  );
}

function ProbeRow({
  label,
  path,
  state,
}: {
  label: string;
  path: string;
  state: ProbeState;
}) {
  return (
    <li className="flex items-center gap-4 bg-surface px-4 py-3.5">
      <StatusDot state={state} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="truncate font-mono text-xs text-ink-3">{path}</div>
      </div>
      <div className="shrink-0 text-right text-xs text-ink-2">
        {state.kind === "pending" && "checking"}
        {state.kind === "ok" && (
          <>
            <div className="font-medium text-success">reachable</div>
            <div className="text-ink-3">
              v{state.version} &middot; {state.environment}
            </div>
          </>
        )}
        {state.kind === "failed" && (
          <div className="max-w-[16rem] text-danger">{state.message}</div>
        )}
      </div>
    </li>
  );
}

function StatusDot({ state }: { state: ProbeState }) {
  const color =
    state.kind === "ok"
      ? "bg-success"
      : state.kind === "failed"
        ? "bg-danger"
        : "bg-ink-3 animate-pulse";
  return <span className={`size-2.5 shrink-0 rounded-full ${color}`} aria-hidden />;
}
