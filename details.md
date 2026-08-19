# Details

Working context for bagsMarkets: what exists, why it was built that way, and the
traps that have already caught us once. Written so a new session — or a new
engineer — can pick this up without re-deriving anything.

For the phased plan see [docs/build-plan.md](docs/build-plan.md). For decisions
with their trade-offs see [docs/architecture.md](docs/architecture.md).

---

## Where things stand

| Phase | Status |
| --- | --- |
| 0 — Foundation | complete |
| 1 — Product shell | complete |
| 2 — Core data model | complete (seed landed in Phase 3) |
| 3 — Bags and Solana | auth, Bags reads, and balances done; transactions outstanding |
| 7 — Hardening | rate limiting, CORS fail-closed, startup guards, runbook done; CAPTCHA and web smoke test outstanding |

**Live infrastructure:** Supabase project `pmfcbbkjxlkggaixpkth` (us-east-1),
GitHub `el-uno/bagsMarket`, CI green on `main`.

**Repo location:** `~/dev/bagsMarkets`. This matters — see *iCloud* below.

---

## Shape of the system

```
browser ──wallet sign-in──> Supabase Auth
   │                             │
   │ session cookie              │ JWKS
   ▼                             ▼
Next.js server components ──> NestJS API ──> Supabase Postgres (Drizzle)
                                   ├──────> Bags SDK
                                   └──────> Helius RPC
```

The browser touches Supabase for **authentication only**. Every read and write
of application data goes through the API. `packages/db` is server-side only;
`packages/types` holds the wire contracts and is safe for the browser.

### Layout

| Path | Contents |
| --- | --- |
| `src/` | Next.js web app |
| `apps/api/` | NestJS service |
| `packages/db/` | Drizzle schema, migrations, seed |
| `packages/types/` | API contracts, dependency-free |

---

## Endpoints

| Route | Auth | Returns |
| --- | --- | --- |
| `GET /health` | public | liveness |
| `GET /me` | required | profile + wallets; **creates both on first call** |
| `GET /launches` | required | caller's launches |
| `GET /positions` | required | Bags claimable fee positions + `source` |
| `GET /balances` | required | SOL balance per owned wallet |
| `GET /jobs` | none yet | system job records |
| `GET /claims` | required | caller's claims |
| `POST /claims` | required | starts a claim, returns unsigned transactions |
| `POST /claims/:id/signature` | required | records the signature the wallet produced |

Every authenticated endpoint resolves the wallet from **our own records**, never
from the request. A caller cannot ask for data belonging to an address they have
not proven ownership of.

---

## Decisions worth not re-litigating

### Tokens are verified against JWKS, not the JWT secret

Supabase signs access tokens with rotating asymmetric keys (**ES256**) published
at `/auth/v1/.well-known/jwks.json`. `SUPABASE_JWT_SECRET` is the legacy
symmetric secret and does **not** verify them — reaching for it is the obvious
wrong turn. The API checks issuer *and* the `authenticated` audience.

**The audience check is load-bearing.** Supabase's anon and service-role keys are
valid JWTs from the same issuer, and service-role bypasses RLS. Without that
check either would be accepted as a user session. There is a test for it, and it
has been confirmed to fail when the check is removed.

### Profiles are created on first authenticated request

Supabase creates `auth.users` at sign-in and knows nothing about our `profiles`
table. Rather than a trigger on a table we do not own, `GET /me` inserts the
profile and the signing wallet, with `ON CONFLICT DO NOTHING` for the burst of
requests a client fires right after sign-in.

The `(app)` layout calls `/me` on every authenticated page load, so **no route
into the app can leave a user without a profile**. This is not incidental — the
first version shipped without that call and sign-in silently produced no profile.

### Ownership is enforced twice

Every domain row carries `profile_id`.

1. **The API filters by the authenticated profile.** This is the control that
   must be correct.
2. **RLS policies are the backstop** for anything reaching the database another
   way.

The API connects with a privileged role and **bypasses RLS entirely**, so a
missing `where profile_id = …` is not caught by the database. RLS protects
against a leaked anon key or a future direct-from-browser query, not against our
own bugs.

`jobs` deliberately has no RLS policy: rows can be system-owned
(`profile_id IS NULL`), and RLS-enabled-with-no-policy denies all access to
unprivileged roles. Supabase's linter flags this forever; it is correct.

### Amounts are strings, everywhere

Lamports and token amounts are u64 and exceed `Number.MAX_SAFE_INTEGER`. They are
`numeric(40,0)` in Postgres, strings on the wire, and formatted via `BigInt`.

The Bags SDK types lamports as a JS `number`, so anything above ~9.007e15 has
**already** lost precision before it reaches us. We convert at the boundary to
avoid compounding it.

### `lamports: null` ≠ `"0"`

A null balance means *we could not find out*. Zero means *the wallet is empty*.
Showing an empty wallet to someone who has funds is worse than showing nothing,
so the two stay distinct through the API and the UI. There is a test for it.

### Bags sits behind a port

`@bagsfm/bags-sdk` takes the API key as a **required constructor argument** —
without one there is nothing to inject at all. So the SDK lives behind a
`BagsPort` interface with two adapters chosen at startup:

| Condition | Adapter | `source` |
| --- | --- | --- |
| `BAGS_API_KEY` **and** `HELIUS_RPC_URL` set | live SDK | `"bags"` |
| either missing | fixture | `"fixture"` |

Every response carries `source`, and the dashboard shows a banner when it is
`"fixture"`. **Invented numbers must never read as real ones.**

### There is no "list my launches" in the Bags SDK

Checked every service. The wallet-centric read is
`fee.getAllClaimablePositions(wallet)` — *fee positions, not launches*. The
`launches` table therefore cannot be filled by asking Bags what a user owns; it
needs a different source (the creation flow, or indexing by mint). `/launches`
currently reads only our own table.

### The API never signs and never broadcasts

`POST /claims` hands **unsigned** transactions to the browser; the user's wallet
signs and sends them, and the signature comes back to `POST
/claims/:id/signature`. Private keys never leave the wallet, and the API never
holds authority to move funds.

The claim row is written **before** the transactions go out, so an abandoned
claim still leaves a trace. Recording only on success would lose exactly the
attempts worth seeing — the ones that failed partway.

Two guards, both mutation-tested:

- **One pending claim per mint.** Without it a double-click produces two rows
  racing to record the same on-chain event.
- **A claim id is not a capability.** Writes are scoped to the caller, so holding
  someone else's claim id is not enough to write to it.

`claims.tx_signature` is unique, so replaying a signature is rejected by the
database rather than quietly recording one event twice.

### `claims.launch_id` is nullable

The schema originally assumed every claim belonged to a launch we knew about.
Bags reports claimable fees **per mint**, and we only have launch rows for
launches created here — so most claims have no launch to point at. Migration
`0004` drops the NOT NULL rather than inventing a placeholder launch.

### Balance caching is in-memory, not Redis

The dashboard is force-dynamic, so every load would otherwise hit Helius, which
bills per request. A 15-second in-process cache removes almost all of that at no
cost in dependencies.

**Its limit is real:** per-process and lost on restart, so it stops helping the
moment the API runs more than one instance. That is when it becomes Redis —
already in `docker-compose.yml` for the purpose.

---

## Traps

### iCloud will corrupt `node_modules`

The repo used to live in `~/Documents`, which iCloud syncs
(`CloudDocs/Documents` is a symlink straight to it). iCloud duplicated files
inside `node_modules` — **592 entries** like `@types/ws 3` — and deleted others
outright. Symptoms: `tsc` hanging forever, `Cannot find type definition file for
'ws 3'`, modules vanishing mid-run.

Deleting `node_modules` and running `npm ci` reproduced the **identical** 592
duplicates, which is what proved it was not install debris.

**Keep this repo out of `~/Documents` and `~/Desktop`.** `~/Downloads` is not
synced, but `~/dev` is the better home.

Every `tsconfig.json` now pins `types` explicitly rather than auto-including
everything under `node_modules/@types`. Good practice regardless, and it makes
compilation independent of stray entries.

### The lock file is platform-sensitive

npm records optional native binaries only for the platform that resolved them, so
a lock built on macOS can be missing what Linux CI needs — and it still works
locally, which is what makes it quiet. This broke CI twice: `@emnapi/*` (via
`@img/sharp-wasm32`, from Next) and `@rolldown/binding-linux-x64-gnu` (from
vitest).

A normal `npm install <pkg>` **preserves** the multi-platform entries, so routine
work is fine. When CI fails on `npm ci` with `Missing: … from lock file` or
`Cannot find native binding`:

```bash
npm run lock:refresh
```

Three details in that script each cost a failed CI run when missed: it uses
`node:24-slim` (glibc, not Alpine's musl), deletes the lock first (otherwise npm
keeps the pruned tree), and resolves in a temp directory with **no
`node_modules`** in scope (otherwise it prunes straight back to the host
platform).

Never fix it by deleting `package-lock.json` and running `npm install` on macOS —
that *is* the cause.

### Adding a table means editing two files

`drizzle-kit` does not generate extensions, triggers, or RLS. A new table needs a
policy added to the hand-written migration **and** an entry in
`migrations/meta/_journal.json`. A table with RLS left off is an open table.

### Never edit schema in the Supabase dashboard

Drizzle is the schema authority. Dashboard changes are invisible to it, and the
next `db:migrate` will disagree with the database.

### Rate limiting keys on IP, not profile

Per-profile limits would be better — a shared NAT throttles unrelated users
together, and one account rotating addresses evades an IP limit. It is not
reachable here: the throttler runs as an `APP_GUARD`, and global guards execute
**before** route-level ones, so `AuthGuard` has not attached `req.user` yet.

Reading the token in the throttler without verifying it would be worse than
useless — `sub` would be attacker-controlled, so anyone could mint a fresh
bucket per request by editing it.

Defaults are 30 per 10s and 200 per 60s, both configurable by env.

The guard also emits a plain **`Retry-After`**. Named throttlers make the library
emit `Retry-After-burst` / `Retry-After-sustained`, which no standard client,
proxy, or SDK retry logic reads.

### Three conditions refuse to boot

Each exists because of a real mistake, and each fails at startup rather than in
production:

1. `CORS_ORIGINS` unset in production.
2. `CORS_ORIGINS` containing `localhost` in production — almost always a copied
   `.env` rather than an intent.
3. `NEXT_PUBLIC_SOLANA_CLUSTER` disagreeing with the network `HELIUS_RPC_URL`
   points at.

All three are verified by actually running the built API and confirming it
refuses to start.

### The advertised cluster must match the RPC

`NEXT_PUBLIC_SOLANA_CLUSTER` is what the UI shows; `HELIUS_RPC_URL` is where
transactions execute. These were mismatched — UI said `devnet`, RPC was
**mainnet** — which is cosmetic while everything is read-only and expensive once
funds move.

Both now say mainnet, and `BagsModule` **throws at startup** if they disagree
again. Failing to boot is the correct response: the alternative is signing real
transactions on a network the UI is not showing.

### Migrations connect through the pooler

The direct host `db.<ref>.supabase.co` is **IPv6-only**, and many resolvers —
including this Mac's and CI's — will not return AAAA records to `getaddrinfo`.

- `DIRECT_URL` → session pooler, port **5432** (supports DDL)
- `DATABASE_URL` → transaction pooler, port **6543** (why `prepare: false` exists)

### `auth.users` is not ours

Supabase owns it. `drizzle-kit` will emit `CREATE SCHEMA "auth"` in any migration
that first references it; those statements were removed by hand from `0000` and
the snapshot records the table as already present. If a future migration emits
auth DDL again, delete it before applying.

---

## Testing

```bash
docker compose up -d postgres
npm test
```

**32 tests, both against a real Postgres with the real migrations applied.**

- `packages/db` — 12 RLS policy tests. Verified to fail: disabling RLS on
  `launches` breaks five of them, including a cross-tenant delete that succeeds
  when RLS is off.
- `apps/api` — 20 integration tests booting the whole Nest app. Tokens are
  **real ES256, signed against a local JWKS**, not stubbed — that is what makes
  the wrong-audience case expressible. Verified to fail against three deliberate
  mutations (audience check, wallet recording, ownership filter).

`NODE_ENV=test` makes `AppModule` ignore `.env` files, so the suite cannot run
against the real Supabase project by accident.

**Known gap:** nothing covers the web app calling the API. That is exactly the
shape of the `/me` bug that shipped — endpoint correct, nothing invoking it.
Closing it needs a browser-level smoke test.

---

## Commands

```bash
npm run api:dev        # API on :4000 — must be running or (app) pages error
npm run dev            # web on :3000
npm test               # both suites (needs the postgres container)
npm run db:seed        # fixtures; safe to re-run
npm run db:migrate     # apply migrations (needs DIRECT_URL)
npm run lock:refresh   # only when CI fails on npm ci
```

Seed rows use deterministic ids in the `5eed…` range and the script deletes
exactly those before re-inserting, so it **cannot touch a row it did not
create** and three runs leave the same state as one.

---

## Outstanding

**Before any public deployment.** Rate limiting, CORS fail-closed, and the
startup guards are done — see [docs/runbook.md](docs/runbook.md). **CAPTCHA is
not**, and it is the one that matters most: Web3 accounts carry no email or
phone, so signup is free to automate. It cannot be wired until CAPTCHA is
enabled in the Supabase dashboard, because the client needs the site key that
only exists then.

**Credentials to rotate.** The database password, Bags key, Helius key, and a
GitHub token all passed through a chat transcript in plain text. Nothing is
exposed — `.env.local` is gitignored and verified — but rotation is cheap.

**Stale iCloud copy.** A `bagsMarkets` folder may still exist in iCloud Drive from
before the move, holding source and a `.env.local` full of live keys. Worth
deleting.

**Unfinished work.** Launch creation and fee-sharing transactions are the rest of
Phase 3; claiming is built but **the real broadcast is unverified** — it needs a
wallet with an actual claimable position, which the signed-in wallet does not
have. SPL token balances are not read, only SOL. `/jobs` is not scoped to a
profile. No deployment exists.
