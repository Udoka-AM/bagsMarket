# Deployment Runbook

Vercel for the web app, Railway for the API, Supabase for Postgres and Auth.

Nothing is deployed yet. This is the procedure for the first deploy and for
every one after.

---

## Before the first deploy

These are not optional. Web3 accounts carry no email or phone, so **creating
them is free and trivially automated** — a public URL without these is an open
invitation.

- [ ] **CAPTCHA hostnames.** hCaptcha is wired and the secret is in Supabase, but
      the site's allowed-hostname list must contain both `localhost` (for
      development) and the deployed domain. hCaptcha shows *"local host
      detected"* and refuses to verify otherwise.
- [ ] **`CORS_ORIGINS` set to the deployed web origin.** The API refuses to
      start in production without it, and refuses if it contains `localhost`.
- [ ] **`NEXT_PUBLIC_SOLANA_CLUSTER` matches `HELIUS_RPC_URL`.** The API throws
      at startup if they disagree. A mismatch means the UI advertises one
      network while transactions execute on another.
- [ ] **Rotate every credential** that has been pasted into a chat, a terminal,
      or a screenshot. Currently that means the database password, Bags key,
      Helius key, and GitHub token.

---

## The API needs a persistent process

Railway, Fly or Render — **not Vercel functions**. The BullMQ worker runs inside
the API process and only works while something is alive to poll the queue. On
serverless it would start, serve requests, and silently process no jobs at all.

```bash
docker build -f apps/api/Dockerfile -t bagsmarkets-api .
```

Built from the repo root, because npm workspaces need the root manifest and lock
file to resolve `@bagsmarkets/*`.

The container runs Node as PID 1 so it receives SIGTERM directly. That is what
lets `enableShutdownHooks()` fire and the worker finish in-flight jobs — verified
by stopping the container and checking it exits **0** rather than 137.

## Environment

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Vercel | Public URL of the API |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Safe to expose; RLS constrains it |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | Vercel | Must match the RPC network |
| `CORS_ORIGINS` | Railway | The Vercel origin; **no localhost** |
| `DATABASE_URL` | Railway | Transaction pooler, port **6543** |
| `DIRECT_URL` | migrations | Session pooler, port **5432** |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway | **Bypasses RLS.** API only, never `NEXT_PUBLIC_` |
| `HELIUS_RPC_URL` | Railway | Server-side only |
| `BAGS_API_KEY` | Railway | Server-side only |
| `THROTTLE_*_LIMIT` | Railway | Optional; defaults are 30/10s and 200/60s |

**The two database URLs are not interchangeable.** The transaction pooler (6543)
does not support prepared statements — which is why `packages/db` sets
`prepare: false` — and cannot run DDL. The session pooler (5432) can. Using the
wrong one fails in ways that look like anything but a port number.

Never use the direct host `db.<ref>.supabase.co`: it is **IPv6-only**, and most
CI runners have no IPv6 route to it.

---

## Deploy

Migrations first. A web app expecting columns that do not exist yet fails
loudly; a database ahead of the app usually does not.

```bash
# 1. migrations, against the session pooler
DIRECT_URL="postgresql://...5432/postgres" npm run db:migrate

# 2. API — Railway picks up the push
git push origin main

# 3. web — Vercel picks up the same push
```

Verify in this order:

```bash
curl -sf https://<api-host>/health          # {"ok":true,"service":"api"}
curl -s -o /dev/null -w "%{http_code}" https://<api-host>/me   # expect 401
```

`401` from `/me` is the signal that matters: it proves auth is enforced rather
than open. Then load the web app, sign in with a wallet, and confirm the
dashboard renders your address.

---

## Rollback

The web app and API roll back independently; **migrations do not**.

```bash
git revert <sha> && git push origin main
```

Vercel and Railway both redeploy from `main`. Vercel also offers instant
rollback to a previous deployment in its dashboard, which is faster when the
web app alone is broken.

**Migrations are forward-only.** There are no `down` migrations, deliberately —
a generated `down` that has never been run is a false comfort. To undo a schema
change, write a new migration that reverses it. This is why additive changes
(new nullable column) are strongly preferred over destructive ones (drop,
rename, tighten a constraint): additive changes let the old code keep running
while the new deploy rolls out.

---

## When something breaks

**API will not start.** Check the logs first — three conditions deliberately
refuse to boot, and each says exactly what is wrong: missing `CORS_ORIGINS` in
production, `localhost` in `CORS_ORIGINS` in production, and a cluster/RPC
network mismatch. These are guards, not bugs.

**Every request returns 401.** The API verifies tokens against Supabase's JWKS
at `NEXT_PUBLIC_SUPABASE_URL`. If that variable points at the wrong project, every
token fails verification. `SUPABASE_JWT_SECRET` is **not** used for this and
setting it will not help.

**Requests return 429.** The rate limiter is working. Defaults are 30 per 10s
and 200 per 60s per IP. Raise `THROTTLE_BURST_LIMIT` / `THROTTLE_SUSTAINED_LIMIT`
if legitimate traffic is being caught — but check first that it is not one
client retrying in a loop.

**Dashboard shows "Sample data".** `BAGS_API_KEY` or `HELIUS_RPC_URL` is missing,
so the fixture adapter is serving invented numbers. The startup log says which
adapter was selected.

**Balances show "unavailable" rather than a number.** The RPC did not respond.
Distinct from a `0` balance, which is real.

---

## Notes for an incident

Write these down while it is happening, not after:

- What the user-visible symptom was, and when it started.
- What changed immediately before — deploy, migration, config, or an upstream
  provider.
- What you checked and what it showed, including things that turned out fine.
  The eliminated possibilities are half the value.
- What actually fixed it, and whether that was a fix or a mitigation.

Afterwards, the question worth answering is not who broke it but **what made it
possible and what would have caught it sooner** — a test, a guard, an alert. The
three startup guards above each exist because of a real mistake.
