/**
 * API contracts shared between the web app and the API.
 *
 * These are hand-authored on purpose. They are not inferred from the Drizzle
 * schema, so that what we store and what we serve can diverge without one
 * dragging the other along — and so database columns never leak to the browser
 * just because they exist. See docs/architecture.md.
 *
 * This package must stay dependency-free and runtime-free: it is imported by
 * client bundles.
 */

export type LaunchStatus = "draft" | "pending" | "live" | "failed" | "closed";
export type ClaimStatus = "pending" | "confirmed" | "failed";
export type AlertSubject = "launch" | "token" | "wallet" | "repository";
export type AlertChannel = "in_app" | "email" | "webhook";
export type DeliveryStatus = "pending" | "delivered" | "failed";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "dead";

/** ISO 8601 timestamp. Dates cross the wire as strings, never as Date. */
export type IsoDateTime = string;

/**
 * Token amounts in base units, as a decimal string. u64 exceeds
 * Number.MAX_SAFE_INTEGER, so these must never be parsed into a JS number.
 */
export type TokenAmount = string;

export type Profile = {
  id: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: IsoDateTime;
};

export type Wallet = {
  id: string;
  address: string;
  label: string | null;
  isPrimary: boolean;
  /** Null for watch-only wallets whose ownership was never proven. */
  verifiedAt: IsoDateTime | null;
};

export type Launch = {
  id: string;
  name: string;
  symbol: string | null;
  tokenMint: string | null;
  status: LaunchStatus;
  launchedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
};

export type FeeShare = {
  id: string;
  recipientAddress: string;
  basisPoints: number;
};

export type Claim = {
  id: string;
  launchId: string;
  amount: TokenAmount;
  tokenMint: string;
  txSignature: string | null;
  status: ClaimStatus;
  confirmedAt: IsoDateTime | null;
};

export type Alert = {
  id: string;
  name: string;
  subjectType: AlertSubject;
  subjectRef: string;
  channel: AlertChannel;
  isActive: boolean;
  mutedUntil: IsoDateTime | null;
  lastFiredAt: IsoDateTime | null;
};

export type AlertEvent = {
  id: string;
  alertId: string;
  firedAt: IsoDateTime;
  deliveryStatus: DeliveryStatus;
  explanation: string | null;
};

export type Job = {
  id: string;
  kind: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  scheduledFor: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
};

export type ActivityEntry = {
  id: string;
  kind: string;
  subjectType: string | null;
  subjectRef: string | null;
  occurredAt: IsoDateTime;
};

/**
 * What `GET /me` returns: the caller's profile plus every wallet linked to it.
 *
 * Returned together because the web app needs both on first load — the profile
 * to know who you are, the wallets to show which address you signed in with.
 */
export type Me = {
  profile: Profile;
  wallets: Wallet[];
};

/** Cursor-paginated list envelope. `nextCursor` is null on the last page. */
export type Paginated<T> = {
  items: T[];
  nextCursor: string | null;
};
