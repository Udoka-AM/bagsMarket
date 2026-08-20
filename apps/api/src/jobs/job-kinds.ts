/**
 * Every kind of background work, and the shape of its payload.
 *
 * Declared in one place so a handler and its enqueue site cannot disagree about
 * the payload — the compiler rejects a mismatch rather than the worker failing
 * at runtime on a field that was never sent.
 */
export type JobPayloads = {
  /**
   * Checks pending claims against the chain and settles them.
   *
   * Without this a claim records a signature and stays `pending` forever: the
   * wallet broadcasts the transaction, and nothing ever looks at what happened
   * to it.
   */
  "claims.reconcile": { profileId?: string };
};

export type JobKind = keyof JobPayloads;

/** The queue every kind shares. Separate queues are only worth it under load. */
export const QUEUE_NAME = "bagsmarkets";
