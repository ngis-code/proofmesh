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
- `apps/web` – Minimal React UI (Vite + TypeScript) for stamping and verifying
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
  - `GET  /api/proofs?limit=100`              – latest proofs (debug)
  - `GET  /api/orgs`                          – orgs (debug)
  - `GET  /api/validators`                    – validators + presence (debug)
  - `GET  /api/validator-runs?limit=100`      – validator runs (debug)
  - `POST /api/validators/register`           – validator self-registration (internal)
- **Web UI**: `http://localhost:5173`
- **Cockroach Admin UI** (dev): `http://localhost:8080`
- **n8n UI** (optional): `http://localhost:5678`

Environment configuration is driven by `.env` (see `.env.example` for defaults).

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

- Writes a new row in `proofs` with `status = 'pending'`.
- If `artifactId` is provided:
  - Links `version_of` to the latest proof for `(orgId, artifactId)` when present.
- Selects enabled validators (up to 3) and publishes a `STAMP` command for each via MQTT.
- Returns the proof plus the list of validator IDs that were targeted.

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
  - Step 2: If DB already has a confirmed proof, return immediately with `status: "valid"`.
  - Step 3: If not confirmed:
    - Ensure there is a `proofs` row (type `"verify"` if needed).
    - Select enabled validators (up to 3) and publish `VERIFY` commands via MQTT.
    - **Return immediately** with:
      - `status`: `"unknown"` or `"low_confidence"` based on DB state.
      - `validators_confirmed: 0`
      - `validators_total: <number of validators asked>`
      - `validators_requested: [<validatorIds>]`
      - `proof`: the proof record being checked.
  - Validators respond asynchronously; the API stores their runs and updates the proof’s status in the background. You can inspect the final state via `GET /api/proofs/:id` and `GET /api/proofs/:id/validators`.

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


