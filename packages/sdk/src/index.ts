/**
 * ProofMesh SDK for JavaScript/TypeScript
 *
 * Official SDK for interacting with the ProofMesh API
 * @packageDocumentation
 */

export interface ProofMeshConfig {
  apiKey: string;
  orgId: string;
  baseUrl?: string;
}

export interface StampOptions {
  /**
   * File or binary content to hash and stamp.
   *
   * - In browsers: pass a `File` or `Blob`.
   * - In Node.js: pass a `Buffer` or `Uint8Array` (Buffer extends Uint8Array),
   *   or an `ArrayBuffer`.
   */
  file: File | Blob | ArrayBuffer | Uint8Array;
  artifactType: string;
  artifactId: string;
}

export interface StampResponse {
  proof: {
    id: string;
    hash: string;
    orgId: string;
    artifactType: string;
    artifactId: string | null;
    status: string;
    createdAt: string;
  };
  validators: string[];
}

export interface VerifyOptions {
  hash: string;
  /**
   * Verification mode:
   * - 'db_only' (default) uses only the ProofMesh DB
   * - 'db_plus_validators' also asks live validators when needed
   */
  mode?: 'db_only' | 'db_plus_validators';
}

export interface VerifyFileOptions {
  file: File | Blob | ArrayBuffer | Uint8Array;
  mode?: 'db_only' | 'db_plus_validators';
}

export interface VerifyResponse {
  isValid: boolean;
  validatorCount: number;
  proof?: {
    id: string;
    hash: string;
    createdAt: string;
    artifactType?: string;
    artifactId?: string;
    versionOf?: string | null;
  };
  proofs?: Array<{
    id: string;
    hash: string;
    createdAt: string;
    artifactType?: string;
    artifactId?: string;
    versionOf?: string | null;
  }>;
}

export interface ProofListResponse {
  proofs: Array<{
    id: string;
    hash: string;
    orgId: string;
    artifactType: string;
    artifactId: string | null;
    createdAt: string;
  }>;
}

export class ProofMeshError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public details?: any
  ) {
    super(message);
    this.name = 'ProofMeshError';
  }
}

export class ProofMesh {
  private apiKey: string;
  private orgId: string;
  private baseUrl: string;

  constructor(config: ProofMeshConfig) {
    if (!config.apiKey) {
      throw new ProofMeshError('API key is required');
    }
    if (!config.orgId) {
      throw new ProofMeshError('Organization ID is required');
    }

    this.apiKey = config.apiKey;
    this.orgId = config.orgId;
    // Default to the public API entrypoint; override for self-hosted / dev.
    this.baseUrl = config.baseUrl || 'https://api.proofmesh.com';
  }

  /**
   * Create a ProofMesh client from environment variables.
   *
   * Reads:
   * - PROOFMESH_API_KEY
   * - PROOFMESH_ORG_ID
   * - PROOFMESH_BASE_URL (optional)
   *
   * Intended for server-side / Node.js environments.
   */
  static fromEnv(): ProofMesh {
    // Use a minimal, local type for process to avoid requiring @types/node.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalProcess: any = (globalThis as any).process;
    const proc = globalProcess as { env?: Record<string, string | undefined> } | undefined;

    if (!proc || !proc.env) {
      throw new ProofMeshError(
        'ProofMesh.fromEnv() is only supported in environments with process.env (e.g. Node.js).'
      );
    }

    const apiKey = proc.env.PROOFMESH_API_KEY;
    const orgId = proc.env.PROOFMESH_ORG_ID;
    const baseUrl = proc.env.PROOFMESH_BASE_URL;

    if (!apiKey) {
      throw new ProofMeshError(
        'PROOFMESH_API_KEY is required in environment for ProofMesh.fromEnv()'
      );
    }
    if (!orgId) {
      throw new ProofMeshError(
        'PROOFMESH_ORG_ID is required in environment for ProofMesh.fromEnv()'
      );
    }

    return new ProofMesh({
      apiKey,
      orgId,
      baseUrl: baseUrl || undefined,
    });
  }

  /**
   * Helper to normalise file/binary inputs into an ArrayBuffer-like object.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async toArrayBuffer(input: File | Blob | ArrayBuffer | Uint8Array): Promise<any> {
    if (input instanceof Blob) {
      return await input.arrayBuffer();
    }
    // Handle ArrayBuffer (and compatible views) via duck-typing on constructor name.
    // We cast through `unknown` to avoid the TS union complaint while keeping runtime safety.
    if (
      typeof input === 'object' &&
      input !== null &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (input as any).constructor &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((input as any).constructor.name === 'ArrayBuffer' ||
        (input as any).constructor.name === 'SharedArrayBuffer')
    ) {
      return input as unknown as ArrayBuffer;
    }
    if (input instanceof Uint8Array) {
      // Respect the view's offset/length
      return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    }
    // Fallback – in environments without Blob/File, caller should not pass those types.
    throw new ProofMeshError('Unsupported file type for hashing');
  }

  /**
   * Compute a SHA-256 hash string (`SHA256:<hex>`) from file/binary input.
   */
  private async computeHash(input: File | Blob | ArrayBuffer | Uint8Array): Promise<string> {
    const arrayBuffer = (await this.toArrayBuffer(input)) as ArrayBuffer;

    if (!globalThis.crypto?.subtle) {
      throw new ProofMeshError(
        'Web Crypto API (crypto.subtle) is not available in this environment. ' +
          'Use Node.js 20+ or a modern browser, or pre-compute the hash yourself.'
      );
    }

    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `SHA256:${hashHex}`;
  }

  /**
   * Create a cryptographic proof for a file
   * @param options - Stamp configuration
   * @returns Promise with proof details
   */
  async stamp(options: StampOptions): Promise<StampResponse> {
    // Compute hash from file/binary content.
    const hash = await this.computeHash(options.file);

    const response = await fetch(`${this.baseUrl}/api/stamp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orgId: this.orgId,
        hash,
        artifactType: options.artifactType,
        artifactId: options.artifactId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ProofMeshError(
        error.message || 'Failed to create stamp',
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Verify a proof by hash
   * @param options - Verification options
   * @returns Promise with verification result
   */
  async verify(options: VerifyOptions): Promise<VerifyResponse> {
    const response = await fetch(`${this.baseUrl}/api/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hash: options.hash,
        orgId: this.orgId,
        mode: options.mode ?? 'db_only',
      }),
    });

    const raw = await response.json().catch(() => null);

    if (!response.ok || !raw) {
      const error = raw ?? { message: response.statusText };
      throw new ProofMeshError(
        (error as any).message || 'Failed to verify proof',
        response.status,
        error
      );
    }

    return this.mapVerifyResponse(raw);
  }

  /**
   * Verify a proof directly from a file/binary input.
   * This computes the hash client-side and then calls `verify`.
   */
  async verifyFile(options: VerifyFileOptions): Promise<VerifyResponse> {
    const hash = await this.computeHash(options.file);
    return this.verify({ hash, mode: options.mode });
  }

  /**
   * Internal helper to normalise various verify response shapes into VerifyResponse.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapVerifyResponse(raw: any): VerifyResponse {
    // Support both legacy VerifyResponse ({ isValid, validatorCount, proof })
    // and the newer /api/verify response ({ status, validators_confirmed, proofs }).
    if ('isValid' in raw) {
      return raw as VerifyResponse;
    }

    const status = (raw as any).status as string | undefined;
    const proofs = (raw as any).proofs as
      | Array<{
          id: string;
          hash: string;
          artifact_type?: string;
          artifact_id?: string;
          version_of?: string | null;
          created_at?: string;
          createdAt?: string;
        }>
      | undefined;

    const isValid = status === 'valid';
    const validatorCount =
      (raw as any).validators_confirmed ??
      (raw as any).validatorCount ??
      0;

    let proof: VerifyResponse['proof'] | undefined;
    let mappedProofs: NonNullable<VerifyResponse['proofs']> | undefined;
    if (proofs && proofs.length > 0) {
      mappedProofs = proofs.map((p) => ({
        id: p.id,
        hash: p.hash,
        createdAt: (p.created_at ?? p.createdAt) as string,
        artifactType: p.artifact_type,
        artifactId: p.artifact_id,
        versionOf: p.version_of ?? null,
      }));
      proof = mappedProofs[0];
    }

    return {
      isValid,
      validatorCount,
      proof,
      proofs: mappedProofs,
    };
  }

  /**
   * Verify a proof publicly (no authentication required)
   * @param hash - The proof hash to verify
   * @returns Promise with verification result
   */
  async publicVerify(
    hash: string,
    mode: 'db_only' | 'db_plus_validators' = 'db_only'
  ): Promise<VerifyResponse> {
    const response = await fetch(`${this.baseUrl}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orgId: this.orgId,
        hash,
        mode,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ProofMeshError(
        error.message || 'Failed to verify proof',
        response.status,
        error
      );
    }

    const raw = await response.json().catch(() => null);
    if (!raw) {
      throw new ProofMeshError('Empty response from verify endpoint', response.status);
    }
    return this.mapVerifyResponse(raw);
  }

  /**
   * List all proofs for the organization
   * @param limit - Maximum number of proofs to return (default: 100)
   * @returns Promise with list of proofs
   */
  async listProofs(limit: number = 100): Promise<ProofListResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/proofs?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ProofMeshError(
        error.message || 'Failed to list proofs',
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Get a specific proof by ID
   * @param proofId - The proof ID to fetch
   * @returns Promise with proof details
   */
  async getProof(proofId: string): Promise<VerifyResponse['proof']> {
    const response = await fetch(
      `${this.baseUrl}/api/proofs/${proofId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ProofMeshError(
        error.message || 'Failed to fetch proof',
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Recursively fetch the complete chain of custody for a proof
   * @param proofId - Starting proof ID
   * @returns Promise with complete chain including all parents
   */
  async getProofChain(proofId: string): Promise<NonNullable<VerifyResponse['proofs']>> {
    const chain: NonNullable<VerifyResponse['proofs']> = [];
    const seen = new Set<string>();

    const fetchRecursive = async (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);

      try {
        const proof = await this.getProof(id);
        if (proof) {
          chain.push(proof);

          // Fetch parent if it exists
          if (proof.versionOf) {
            await fetchRecursive(proof.versionOf);
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to fetch proof ${id}:`, error);
      }
    };

    await fetchRecursive(proofId);
    return chain;
  }
}

// Default export
export default ProofMesh;


