"use client";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

/**
 * Calls the API from the browser.
 *
 * Separate from `apiFetch` in api.ts, which is server-only — it reads the
 * session from `next/headers`, and importing it into a client component pulls
 * server internals into the bundle. This reads the same session through
 * supabase-js instead.
 */
export async function apiClientFetch<T>(
  path: string,
  // Omit rather than intersect: RequestInit already types `body` as BodyInit,
  // and an intersection keeps that narrower type instead of widening it.
  init?: Omit<RequestInit, "body"> & { body?: unknown }
): Promise<T> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Your session has expired. Reload the page and sign in again.");
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store"
  });

  if (!response.ok) {
    // The API's message is more useful than a status code — it distinguishes
    // "already pending" from "nothing claimable" from "bad mint".
    const detail = await response
      .json()
      .then((body: { message?: string }) => body?.message)
      .catch(() => null);

    throw new Error(detail ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}
