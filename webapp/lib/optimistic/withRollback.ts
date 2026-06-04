/**
 * Optimistic mutation helper: apply a local change immediately, fire the
 * network request, and revert (with a toast) if it fails.
 *
 *   await withRollback({
 *     apply: () => setItems(next),          // optimistic update
 *     revert: () => setItems(prev),          // undo on failure
 *     request: () => fetch(...),             // the network call
 *     errorMessage: "Couldn't save",
 *   })
 *
 * `request` may return a value (e.g. the server row) which is passed through.
 */
import { toast } from "sonner";

export async function withRollback<T>({
  apply,
  revert,
  request,
  errorMessage,
}: {
  apply: () => void;
  revert: () => void;
  request: () => Promise<T>;
  errorMessage: string;
}): Promise<T | null> {
  apply();
  try {
    return await request();
  } catch (e) {
    revert();
    toast.error(errorMessage, {
      description: e instanceof Error ? e.message : undefined,
    });
    return null;
  }
}

/** Throwing fetch wrapper: rejects on non-2xx with the server error message. */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
