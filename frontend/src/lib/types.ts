/**
 * Shared API types.
 *
 * Hand-written while the surface is small. Phase 3 replaces this with types
 * generated from the backend OpenAPI document, so the client and server can
 * never drift.
 */

export type HealthResponse = {
  status: "ok";
  service: string;
  version: string;
  environment: string;
};

export type PingResponse = {
  pong: boolean;
  service: string;
  version: string;
  environment: string;
};
