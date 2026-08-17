import { env } from "@/lib/env";

/**
 * Thrown when the API is unreachable or answers with a non-2xx status.
 *
 * Distinguished from a generic Error so pages can render "the API is down"
 * differently from "this page has a bug" — the two need very different
 * reactions from whoever is looking at the screen.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${env.apiUrl}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { accept: "application/json", ...init?.headers },
      // Operational data goes stale immediately; never serve it from the cache.
      cache: "no-store"
    });
  } catch (cause) {
    // fetch rejects on connection refused, DNS failure, timeout — the API being
    // down is the common case in development.
    throw new ApiError(`Could not reach the API at ${url}`, undefined);
  }

  if (!response.ok) {
    throw new ApiError(`API responded ${response.status} for ${path}`, response.status);
  }

  return (await response.json()) as T;
}
