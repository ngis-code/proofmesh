## ProofMesh (v1) – Digital Integrity Network

ProofMesh is a **digital integrity network** that lets you stamp and verify hashes of digital artifacts (files, images, logs, etc.) without ever exposing the underlying content.

v1 is a **single-region dev stack**, but it is intentionally structured so it can evolve into a **multi-region, Cloudflare-fronted global network**.

### What ProofMesh Does

- **Stamp**: Clients send a hash to the **Proof API** (`/api/stamp`), which:
  - Stores a proof record in **CockroachDB** (global truth store).
  - Sends a `STAMP` command via **MQTT** to one or more **validator nodes**.
- **Validate**: Validators:
  - Store only `hash + first_seen_at` in a local **SQLite** database.
  - Never see file contents or metadata.
  - Return `valid` / `unknown` (+ a simple signature) back via MQTT.
- **Aggregate**: The Proof API:
  - Stores each validator's attestation in `validator_runs`.
  - Computes proof status: `pending` → `confirmed` or `failed`.
  - Returns a confidence summary (e.g., `1/3 validators confirmed`).

For v1, this repository also includes a **minimal web UI** and an **optional n8n instance** for future integrations.

---

## Monorepo Layout

The repository is a **pnpm monorepo**:

- `apps/api` – ProofMesh HTTP API (Node + TypeScript, Fastify)
- `apps/validator` – Validator node (Node + TypeScript, MQTT + SQLite)
- `apps/web` – SaaS console (React + Vite) for org/admin workflows and stamping/verifying
- `apps/n8n` – Placeholder docs for n8n workflows
- `packages/shared-types` – Shared TypeScript interfaces (DB rows, MQTT payloads, etc.)
- `packages/shared-config` – Shared config helpers and lightweight logger
- `infra/migrations` – CockroachDB SQL migrations (schema + dev seed validator)
- `infra/docker-compose.dev.yml` – Docker Compose stack for local development

Global configuration:

- `tsconfig.base.json` – Shared TypeScript config
- `pnpm-workspace.yaml` – pnpm workspace definition

---

## Local Development

### Prerequisites

- **Node.js 20+**
- **pnpm 9+**
- **Docker** and **Docker Compose**

### Install Dependencies

From the repo root:

```bash
pnpm install
```

### Start the Dev Stack

From the repo root:

```bash
docker compose -f infra/docker-compose.dev.yml up --build
```

This brings up:

- `cockroachdb` – single-node CockroachDB
- `mqtt` – Mosquitto MQTT broker
- `api` – Proof API (Fastify, port `3000`)
- `validator1` – Demo validator node (uses SQLite volume)
- `web` – Vite dev server for the minimal UI (port `5173`)
- `n8n` – Optional n8n instance (port `5678`)

### Service URLs (default)

- **API**: `http://localhost:3000`
  - `GET  /api/health`
  - `POST /api/stamp`
  - `POST /api/verify`
  - `GET  /api/proofs/:id`
  - `GET  /api/proofs/:id/validators`
  - `GET  /api/proofs?limit=100`                   – latest proofs (debug)
  - `GET  /api/orgs`                               – list all orgs (admin / debug)
  - `POST /api/orgs`                               – create org (creator becomes org admin)
  - `GET  /api/my-orgs`                            – orgs current user belongs to (with role)
  - `GET  /api/orgs/:orgId/users`                  – list users/roles for an org (admin-only)
  - `POST /api/orgs/:orgId/users`                  – add/update user role in an org (admin-only)
  - `POST /api/orgs/:orgId/users/:userId/remove`   – remove user from org (admin-only)
  - `GET  /api/orgs/:orgId/api-keys`               – list API keys for an org
  - `POST /api/orgs/:orgId/api-keys`               – create API key for an org
  - `POST /api/orgs/:orgId/api-keys/:id/revoke`    – revoke API key
  - `GET  /api/validators`                         – validators + presence (debug)
  - `GET  /api/validator-runs?limit=100`           – validator runs (debug)
  - `GET  /api/validator-stats`                    – per-validator aggregated stats
  - `POST /api/validators/register`                – validator self-registration (internal)
- **Web UI**: `http://localhost:5173`
- **Cockroach Admin UI** (dev): `http://localhost:8080`
- **n8n UI** (optional): `http://localhost:5678`

Environment configuration is driven by `.env` (see `.env.example` for defaults).

---

## SaaS Console (apps/web)

The `apps/web` project is a small but complete SaaS console that exercises all of the core API features.

### Authentication

- Powered by **Appwrite**:
  - `VITE_APPWRITE_ENDPOINT` – e.g. `https://nyc.cloud.appwrite.io/v1`
  - `VITE_APPWRITE_PROJECT_ID` – your Appwrite project ID.
- Users log in with their **Appwrite email + password**.
- The console:
  - Creates an Appwrite session and JWT via the Appwrite JS SDK.
  - Stores the JWT locally and sends it to the ProofMesh API in:
    - `Authorization: Bearer <APPWRITE_JWT>` for all protected endpoints.

### Main flows

- **My orgs**
  - Uses `GET /api/my-orgs` to show only the orgs that the logged-in user belongs to, including their role (`admin` / `viewer`).
  - Uses `POST /api/orgs` to create new orgs; the creator is automatically made an `admin` in `org_users`.

- **Org dashboard (`/orgs/:orgId`)**
  - **Overview tab**:
    - Shows org metadata (name, id, created_at).
  - **Users tab**:
    - `GET /api/orgs/:orgId/users` to list Appwrite user IDs and roles (admin-only).
    - `POST /api/orgs/:orgId/users` to add/update a user’s role in that org.
    - `POST /api/orgs/:orgId/users/:userId/remove` to remove a user from the org.
  - **API keys tab**:
    - `GET /api/orgs/:orgId/api-keys` to list existing keys (scopes, rate limit, last used, revoked).
    - `POST /api/orgs/:orgId/api-keys` to create a new **org-scoped API key** (shows the raw key once).
    - `POST /api/orgs/:orgId/api-keys/:id/revoke` to revoke a key.
  - **Stamp tab**:
    - Allows file upload; computes SHA-256 in-browser.
    - Calls `POST /api/stamp` with `{ orgId, hash, artifactType }` using the user’s JWT.
  - **Verify tab**:
    - Allows file upload and selection of mode (`db_only` / `db_plus_validators`).
    - Calls `POST /api/verify` (public endpoint) with `{ orgId, hash, mode }`.
  - **Proofs tab**:
    - Uses:
      - `GET /api/proofs?limit=100`
      - `GET /api/validator-runs?limit=100`
    - Shows proofs filtered to the current org (when `orgId` is present) and the latest validator runs.

This console is designed as a reference implementation: real customers can either use it directly or model their own dashboards / SDKs on the same flows and API contracts described below.

---

## High-Level Architecture

At a high level, ProofMesh v1 looks like this:

- **Clients → Proof API**
  - `/api/stamp` – stamp a hash for a given org.
  - `/api/verify` – verify a hash (`db_only` or `db_plus_validators`).

- **Proof API → CockroachDB**
  - Stores:
    - `orgs` – organizations using ProofMesh.
    - `validators` – licensed validator nodes.
    - `proofs` – proofs per org and hash (with optional version chain).
    - `validator_runs` – individual validator attestations.

- **Proof API → MQTT → Validators**
  - Sends **commands**:
    - `STAMP` – “record this hash as seen”.
    - `VERIFY` – “tell me if you have ever seen this hash”.
  - Topic pattern:
    - Commands: `proofmesh/validators/<validatorId>/commands`
    - Results: `proofmesh/validators/<validatorId>/results`

- **Validators → MQTT → Proof API**
  - Respond with **results**:
    - `STAMP_RESULT` | `VERIFY_RESULT`
    - `result`: `valid` | `unknown` | `invalid` | `error`
    - `signature`: simple HMAC placeholder in v1
  - API stores responses in `validator_runs` and recomputes proof status.

- **Validator Local Storage (SQLite)**
  - Each validator maintains a simple local DB:
    - `hashes(hash TEXT PRIMARY KEY, first_seen_at TEXT NOT NULL)`
  - Only hash + timestamp, **never file content**.

---

## API Overview

### Authentication & Authorization

ProofMesh supports two auth mechanisms:

- **User auth (Appwrite JWT)** – for SaaS UI / dashboard.
- **Org API keys** – for server-to-server integrations.

#### Appwrite JWT (users)

When `APPWRITE_ENDPOINT` and `APPWRITE_PROJECT_ID` are set for the API:

- Most endpoints expect:

  ```http
  Authorization: Bearer <APPWRITE_JWT>
  ```

- The API validates the JWT by calling Appwrite:

  ```http
  GET /v1/account
  X-Appwrite-Project: <APPWRITE_PROJECT_ID>
  X-Appwrite-JWT: <APPWRITE_JWT>
  ```

- If Appwrite returns 200 with a user object, the request is allowed and `request.auth.via === "jwt"`.

#### Org API keys (servers)

- API keys live in the `org_api_keys` table as **SHA-256 hashes** of the raw key.
- To authenticate from a server, send:

  ```http
  x-api-key: <raw_api_key>
  ```

- The API:
  - Hashes the key and looks up `org_api_keys.key_hash` (only non-revoked keys).
  - Enforces `rate_limit_per_minute` per key (simple per-process bucket).
  - Attaches `request.auth.via === "api-key"` and `request.auth.orgId`.

#### Public endpoints

Even with auth enabled:

- `GET /api/health` – always public.
- `POST /api/verify` – **public** (hash verification by anyone).

All other endpoints require either a valid `x-api-key` or a valid Appwrite JWT (when auth is configured).

---

### Org & User Management

#### `POST /api/orgs`

Create a new org. Requires a valid Appwrite JWT.

**Request:**

```http
POST /api/orgs
Authorization: Bearer <APPWRITE_JWT>
Content-Type: application/json

{ "name": "My Org Name" }
```

**Behavior:**

- Inserts a new row into `orgs` with a generated UUID.
- Creates/updates an `org_users` row making the calling user an **admin** of that org.
- Returns `{ org }` with the generated `id`.

#### `GET /api/my-orgs`

Return orgs the current user belongs to (based on `org_users`), including role.

**Request:**

```http
GET /api/my-orgs
Authorization: Bearer <APPWRITE_JWT>
```

**Response:**

```json
{
  "orgs": [
    {
      "id": "3333...",
      "name": "My Org Name",
      "created_at": "2025-11-20T...",
      "role": "admin"
    }
  ]
}
```

#### `GET /api/orgs/:orgId/users`

List users and roles for an org (admin-only).

#### `POST /api/orgs/:orgId/users`

Add or update a user’s role in an org. Body: `{ "userId": "APPWRITE_USER_ID", "role": "admin" | "viewer" }`.

#### `POST /api/orgs/:orgId/users/:userId/remove`

Remove a user from an org.

---

### `POST /api/stamp`

Stamp a new hash for an org.

**Body:**

```json
{
  "orgId": "UUID",
  "hash": "SHA256:<hex>",
  "artifactType": "file",
  "artifactId": "optional-logical-id"
}
```

**Behavior:**

- First, the API checks **online validators in this region**:
  - If fewer than `STAMP_MIN_ONLINE_VALIDATORS` are online and this is **not** already a fallback request, it will try HTTP fallback to peer regions (`STAMP_FALLBACK_APIS`) before creating any proof rows.
  - If no region can handle the stamp, returns:

    ```json
    {
      "error": "not_enough_online_validators",
      "online": 0,
      "required": 1
    }
    ```

- Once a region accepts the stamp:
  - Writes a new row in `proofs` with `status = "pending"`.
  - If `artifactId` is provided:
    - Links `version_of` to the latest proof for `(orgId, artifactId)` when present.
  - Selects online, enabled validators in this API’s region (sample size is configurable via env).
  - Publishes a `STAMP` command for each selected validator via MQTT.
  - Returns:

    ```json
    {
      "proof": { "id": "...", "org_id": "...", "hash": "...", "status": "pending", "...": "..." },
      "validators": ["validator_id_1", "validator_id_2"]
    }
    ```

### `POST /api/verify`

Verify whether a hash is known for an org.

**Body:**

```json
{
  "orgId": "UUID",
  "hash": "SHA256:<hex>",
  "mode": "db_only" | "db_plus_validators"
}
```

- **`db_only`**:
  - Checks existing proofs for `(orgId, hash)`.
  - Returns:
    - `status`: `"valid"` (if any confirmed proof) or `"low_confidence"` / `"unknown"`.
    - No live validator calls.

- **`db_plus_validators`**:
  - Step 1: Perform the same DB lookup as `db_only`.
  - Step 2: If DB already has a confirmed proof, return immediately with `status: "valid"` (no live MQTT calls).
  - Step 3: If not confirmed:
    - Ensure there is a `proofs` row (type `"verify"` if needed).
    - Select enabled validators (up to 3) and publish `VERIFY` commands via MQTT.
    - **Return immediately** with:
      - `status`: `"unknown"` or `"low_confidence"` based on DB state.
      - `validators_confirmed: 0`
      - `validators_total: <number of validators asked>`
      - `validators_requested: [<validatorIds>]`
      - `proof`: the proof record being checked.
  - Validators respond asynchronously; the API stores their runs, recomputes the proof’s status, and updates per-validator stats in `validator_stats`. You can inspect the final state via:
    - `GET /api/proofs/:id`
    - `GET /api/proofs/:id/validators`

### Proof Status Logic

- Each validator response is stored in `validator_runs`.
- After each result, the API recomputes the proof’s `status`:
  - If **any** validator reports `invalid` → `failed`.
  - Else if enough validators report `valid` (simple 2/3 quorum) → `confirmed`.
  - Else if there is at least one run and **no** `valid` results (all `unknown`/`error`) → `failed`.
  - Otherwise (no runs yet) → `pending`.

---

## MQTT & Validator Behavior

### Topics

- Commands to a specific validator:

  - `proofmesh/validators/<validatorId>/commands`

- Results from a specific validator:

  - `proofmesh/validators/<validatorId>/results`

- Presence for a specific validator:

  - `proofmesh/validators/<validatorId>/presence`

The API subscribes to:

- `proofmesh/validators/+/results`
- `proofmesh/validators/+/presence`

### Commands

- `STAMP`:
  - Validator records the hash in its local store (in-memory in v1; designed for SQLite).
  - Responds with `STAMP_RESULT` and `result = 'valid'`.

- `VERIFY`:
  - Validator checks its local store for the hash:
    - If present → `result = 'valid'`.
    - If missing → `result = 'unknown'`.
  - Responds with `VERIFY_RESULT`.

### Signatures (v1)

- Validators compute a simple HMAC signature:
  - HMAC-SHA256 over `hash + timestamp + validatorId` using `VALIDATOR_SECRET`.
- This is a **placeholder**; production can swap in stronger cryptography.

### Validator Registration & Presence

- **Registration**:
  - On startup, each validator calls:
    - `POST /api/validators/register` with `id` and `secret`.
  - The API:
    - Verifies that the validator is **provisioned** in the `validators` table.
    - Verifies that `enabled = true`.
    - Verifies that `api_key_hash === secret`.
    - Marks the validator as online (`online = true`, `last_seen_at = now()`).

- **Presence via MQTT**:
  - Validators publish presence messages on:
    - `proofmesh/validators/<validatorId>/presence` with:

      ```json
      { "validatorId": "<id>", "status": "online" | "offline", "timestamp": "..." }
      ```

  - Validators configure an MQTT **Last Will** message so that if they disconnect uncleanly, the broker emits an `"offline"` presence message.
  - The API listens on `proofmesh/validators/+/presence` and updates:
    - `validators.online`
    - `validators.last_seen_at`

---

## Production Multi-Region & Cloudflare Load Balancer

In production, ProofMesh is intended to run in **multiple regions** (e.g., `us-east`, `us-central`, `us-west`). Each region runs:

- A regional instance of the Proof API.
- A regional MQTT broker cluster.
- CockroachDB nodes as part of a global cluster.

A **Cloudflare Load Balancer** sits in front of all API regions and provides:

- A single public entry point: `https://api.proofmesh.com`
- Health checks for each region’s API endpoints.
- Latency-based routing (send clients to the nearest region).
- Automatic failover if a region goes down.

Validators connect outbound to the **nearest MQTT broker** and can be configured with multiple MQTT URLs (e.g., `mqtt-us-east`, `mqtt-us-central`, `mqtt-us-west`). If one region’s broker becomes unavailable, validators automatically reconnect to another region.

CockroachDB runs as a single **globally-distributed cluster**, so any API region can read/write proof data even if one region is down.

This combination (Cloudflare LB + multi-region APIs + CockroachDB + MQTT-based validators) gives ProofMesh a highly-available, fault-tolerant architecture that can survive regional outages without downtime.

---

## Roadmap / Future Work

Some obvious next steps beyond this v1:

- **Multi-region deployment**
  - Kubernetes + Terraform, per-region API + MQTT clusters.
- **Stronger crypto**
  - Proper key management and signature schemes for validator responses.
- **Advanced validator selection**
  - Region-aware routing, random sampling, adjustable quorum, reputation weighting.
- **Version-chain intelligence**
  - Smarter detection of version histories and related artifacts.
- **Rich n8n workflows**
  - Managed integrations for Drive/S3, Slack/Teams, ticketing systems, etc.

This v1 is intentionally simple and heavily commented so that it can serve as a foundation for those future improvements.




docker run -d \
  --name proofmesh-validator-5 \
  -e VALIDATOR_ID=validator-5 \
  -e VALIDATOR_SECRET=super-secret-5 \
  -e MQTT_URL=mqtt://host.docker.internal:1883 \
  -e API_BASE_URL=http://host.docker.internal:3000 \
  -e VALIDATOR_REGION=us-east \
  -e SQLITE_PATH=/data/validator.db \
  -v /tmp/proofmesh-validator-5:/data \
    infra-validator1:latest

    docker run -d \
  --name proofmesh-validator-7 \
  -e VALIDATOR_ID=validator-7 \
  -e VALIDATOR_SECRET=super-secret-7 \
  -e MQTT_URL=mqtt://host.docker.internal:1883 \
  -e API_BASE_URL=http://host.docker.internal:3000 \
  -e VALIDATOR_REGION=us-east \
  -e SQLITE_PATH=/data/validator.db \
  -v /tmp/proofmesh-validator-7:/data \
    infra-validator1:latest


    INSERT INTO validators (id, name, region, api_key_hash, enabled, created_at, online, last_seen_at)
VALUES
  ('validator-4', 'validator-4', 'us-east', 'super-secret-4', true, now(), false, NULL),
  ('validator-5', 'validator-5', 'us-east', 'super-secret-5', true, now(), false, NULL);