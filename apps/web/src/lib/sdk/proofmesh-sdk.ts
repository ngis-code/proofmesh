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
  file: File | Blob;
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
    this.baseUrl = config.baseUrl || 'https://your-api.proofmesh.com';
  }

  /**
   * Create a cryptographic proof for a file
   * @param options - Stamp configuration
   * @returns Promise with proof details
   */
  async stamp(options: StampOptions): Promise<StampResponse> {
    // Compute hash from file
    const fileToHash = options.file instanceof File ? options.file : new File([options.file], 'file');
    const arrayBuffer = await fileToHash.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = `SHA256:${hashHex}`;

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
  async publicVerify(hash: string): Promise<VerifyResponse> {
    const response = await fetch(`${this.baseUrl}/api/public-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hash }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ProofMeshError(
        error.message || 'Failed to verify proof',
        response.status,
        error
      );
    }

    return response.json();
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
        console.warn(`Failed to fetch proof ${id}:`, error);
      }
    };
    
    await fetchRecursive(proofId);
    return chain;
  }
}

// Default export
export default ProofMesh;
