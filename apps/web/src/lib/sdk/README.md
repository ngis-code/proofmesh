# ProofMesh JavaScript SDK

Official JavaScript/TypeScript SDK for [ProofMesh](https://proofmesh.com) - Create and verify cryptographic proofs for digital files.

## Installation

```bash
npm install @proofmesh/sdk
# or
yarn add @proofmesh/sdk
```

## Quick Start

```javascript
import { ProofMesh } from '@proofmesh/sdk';

const client = new ProofMesh({
  apiKey: 'your-api-key',
  orgId: 'your-org-id'
});

// Create a proof
const proof = await client.stamp({
  file: fileBlob,
  artifactType: 'document',
  artifactId: 'invoice-2024-001'
});

console.log('Proof created:', proof.hash);

// Verify a proof
const verification = await client.verify({
  hash: proof.hash
});

console.log('Valid:', verification.isValid);
```

## API Reference

### `new ProofMesh(config)`

Create a new ProofMesh client instance.

**Parameters:**
- `config.apiKey` (string, required) - Your API key from ProofMesh dashboard
- `config.orgId` (string, required) - Your organization ID
- `config.baseUrl` (string, optional) - Custom API base URL

### `client.stamp(options)`

Create a cryptographic proof for a file.

**Parameters:**
- `options.file` (File | Blob | Buffer, required) - File to create proof for
- `options.artifactType` (string, required) - Type of artifact (e.g., 'document', 'image')
- `options.artifactId` (string, required) - Unique identifier for the artifact

**Returns:** `Promise<StampResponse>`

### `client.verify(options)`

Verify a proof with authentication.

**Parameters:**
- `options.hash` (string, required) - Hash of the proof to verify

**Returns:** `Promise<VerifyResponse>`

### `client.publicVerify(hash)`

Verify a proof publicly without authentication.

**Parameters:**
- `hash` (string, required) - Hash of the proof to verify

**Returns:** `Promise<VerifyResponse>`

### `client.listProofs(limit?)`

List all proofs for your organization.

**Parameters:**
- `limit` (number, optional) - Maximum number of proofs to return (default: 100)

**Returns:** `Promise<ProofListResponse>`

## Error Handling

```javascript
import { ProofMesh, ProofMeshError } from '@proofmesh/sdk';

try {
  await client.stamp({ /* ... */ });
} catch (error) {
  if (error instanceof ProofMeshError) {
    console.error('ProofMesh API Error:', error.message);
    console.error('Status Code:', error.statusCode);
    console.error('Details:', error.details);
  }
}
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions.

```typescript
import { ProofMesh, StampResponse, VerifyResponse } from '@proofmesh/sdk';

const client = new ProofMesh({
  apiKey: process.env.PROOFMESH_API_KEY!,
  orgId: process.env.PROOFMESH_ORG_ID!
});

const proof: StampResponse = await client.stamp({
  file: myFile,
  artifactType: 'document',
  artifactId: 'doc-123'
});
```

## License

MIT
