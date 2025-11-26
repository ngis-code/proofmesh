# ProofMesh JavaScript SDK (`@proofmesh/sdk`)

Official JavaScript/TypeScript SDK for [ProofMesh](https://proofmesh.com) – Create and verify cryptographic proofs for digital files.

## Installation

In a Node.js app or any pnpm workspace that includes this package:

```bash
pnpm add @proofmesh/sdk
# or
npm install @proofmesh/sdk
# or
yarn add @proofmesh/sdk
```

In this monorepo, `@proofmesh/sdk` lives under `packages/sdk` and is built with:

```bash
pnpm --filter @proofmesh/sdk build
```

## Quick Start

### Browser / Frontend

```javascript
import { ProofMesh } from '@proofmesh/sdk';

const client = new ProofMesh({
  apiKey: 'your-api-key',
  orgId: 'your-org-id',
  // Optional: override for self-hosted or local dev
  // baseUrl: 'http://localhost:3000'
});

// Create a proof from a File/Blob
const proof = await client.stamp({
  file: fileBlob,
  artifactType: 'document',
  artifactId: 'invoice-2024-001'
});

console.log('Proof created:', proof.proof.hash);

// Verify a proof
const verification = await client.verify({
  hash: proof.proof.hash,
  mode: 'db_plus_validators' // or 'db_only'
});

console.log('Valid:', verification.isValid);
```

### Server-side (`fromEnv`)

For Node.js / server usage, you can configure the SDK entirely via environment variables:

- `PROOFMESH_API_KEY` – org API key
- `PROOFMESH_ORG_ID` – organization ID
- `PROOFMESH_BASE_URL` – optional API base URL (defaults to `https://api.proofmesh.com`)

```bash
export PROOFMESH_API_KEY="pk_..."
export PROOFMESH_ORG_ID="org_..."
export PROOFMESH_BASE_URL="https://api.proofmesh.com" # optional
```

Then in code:

```typescript
import { ProofMesh } from '@proofmesh/sdk';

const client = ProofMesh.fromEnv();

const stamp = await client.stamp({
  file: myBufferOrFile,
  artifactType: 'document',
  artifactId: 'contract-123'
});

const verifyResult = await client.verify({
  hash: stamp.proof.hash,
  mode: 'db_plus_validators'
});
```

## API Reference

### `new ProofMesh(config)`

Create a new ProofMesh client instance.

**Parameters:**
- `config.apiKey` (string, required) – Your API key from the ProofMesh dashboard
- `config.orgId` (string, required) – Your organization ID
- `config.baseUrl` (string, optional) – Custom API base URL

### `ProofMesh.fromEnv()`

Create a client using environment variables (Node/server environments).

Reads:
- `PROOFMESH_API_KEY` (required)
- `PROOFMESH_ORG_ID` (required)
- `PROOFMESH_BASE_URL` (optional)

### `client.stamp(options)`

Create a cryptographic proof for a file.

**Parameters:**
- `options.file` (File | Blob | ArrayBuffer | Uint8Array, required) – File or binary content to create proof for
- `options.artifactType` (string, required) – Type of artifact (e.g., `document`, `image`)
- `options.artifactId` (string, required) – Unique identifier for the artifact

**Returns:** `Promise<StampResponse>`

### `client.verify(options)`

Verify a proof with authentication.

**Parameters:**
- `options.hash` (string, required) – Hash of the proof to verify
- `options.mode` (`'db_only' | 'db_plus_validators'`, optional, default `'db_only'`) – Verification mode

**Returns:** `Promise<VerifyResponse>`

### `client.verifyFile(options)`

Verify a proof directly from a file or binary input.

**Parameters:**
- `options.file` (File | Blob | ArrayBuffer | Uint8Array, required) – File or binary content to verify
- `options.mode` (`'db_only' | 'db_plus_validators'`, optional, default `'db_only'`) – Verification mode

**Returns:** `Promise<VerifyResponse>`

### `client.publicVerify(hash, mode?)`

Verify a proof publicly without authentication (using the public `/api/verify` endpoint).

**Parameters:**
- `hash` (string, required) – Hash of the proof to verify
- `mode` (`'db_only' | 'db_plus_validators'`, optional, default `'db_only'`) – Verification mode

**Returns:** `Promise<VerifyResponse>`

### `client.listProofs(limit?)`

List all proofs for your organization.

**Parameters:**
- `limit` (number, optional) – Maximum number of proofs to return (default: 100)

**Returns:** `Promise<ProofListResponse>`

### `client.getProof(proofId)`

Fetch a single proof by ID.

### `client.getProofChain(proofId)`

Recursively fetch the complete version chain for a proof, including parents.

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions:

```typescript
import { ProofMesh, StampResponse, VerifyResponse } from '@proofmesh/sdk';

const client = ProofMesh.fromEnv();

const proof: StampResponse = await client.stamp({
  file: myFileOrBuffer,
  artifactType: 'document',
  artifactId: 'doc-123'
});
```

## License

MIT


