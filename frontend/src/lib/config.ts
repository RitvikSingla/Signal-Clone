/**
 * Runtime configuration.
 *
 * Read once here so no component reaches into process.env directly, and so a
 * missing variable fails loudly in one place instead of producing a request to
 * "undefined/api/v1/...".
 */

function required(name: string, value: string | undefined, fallback: string): string {
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === "production") {
    // Loud in production, forgiving locally.
    console.warn(`[config] ${name} is not set, falling back to ${fallback}`);
  }
  return fallback;
}

export const config = {
  apiUrl: required(
    "NEXT_PUBLIC_API_URL",
    process.env.NEXT_PUBLIC_API_URL,
    "http://localhost:8000",
  ),
  wsUrl: required(
    "NEXT_PUBLIC_WS_URL",
    process.env.NEXT_PUBLIC_WS_URL,
    "ws://localhost:8000/ws",
  ),
  apiPrefix: "/api/v1",
} as const;
