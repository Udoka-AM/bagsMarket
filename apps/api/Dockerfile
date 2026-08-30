# The API must run as a long-lived process, not a serverless function: the
# BullMQ worker lives in this process and only works while something is running
# to poll the queue. Railway, Fly, Render and friends are fine; Vercel functions
# are not, and would silently process no jobs at all.
#
# Built from the repo root, because npm workspaces need the root manifest and
# lock file to resolve @bagsmarkets/* :
#
#   docker build -f apps/api/Dockerfile -t bagsmarkets-api .

# --- build -------------------------------------------------------------------
FROM node:24-slim AS build

WORKDIR /repo

# Manifests first, so a dependency install is only redone when they change
# rather than on every source edit.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/

# npm ci, not install: the lock file is the contract, and it is verified to
# contain the Linux binaries this image needs (npm run lock:check).
RUN npm ci --no-audit --no-fund

COPY packages/ packages/
COPY apps/api/ apps/api/

# The API imports the workspace packages, so those compile first.
RUN npm run build --workspace @bagsmarkets/types \
 && npm run build --workspace @bagsmarkets/db \
 && npm run build --workspace @bagsmarkets/api

# --- runtime -----------------------------------------------------------------
FROM node:24-slim AS runtime

ENV NODE_ENV=production

WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/

RUN npm ci --omit=dev --no-audit --no-fund

# Only compiled output. Sources, tests and dev dependencies stay out of the
# image.
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/packages/db/dist packages/db/dist
COPY --from=build /repo/packages/types/dist packages/types/dist

# Drop root. Nothing here needs to write to the filesystem.
USER node

EXPOSE 4000

# Node receives SIGTERM directly as PID 1, which is what makes
# enableShutdownHooks() fire and lets the BullMQ worker finish in-flight jobs.
# Wrapping this in a shell would swallow the signal.
CMD ["node", "apps/api/dist/main.js"]
