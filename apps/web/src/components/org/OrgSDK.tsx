import { useState } from 'react';
import { Code, Copy, Check, Sparkles, Terminal, BookOpen, ExternalLink, Package } from 'lucide-react';

interface OrgSDKProps {
  orgId: string;
}

const getCodeExamples = (orgId: string, apiKey: string) => ({
  javascript: {
    install: `npm install @proofmesh/sdk`,
    init: `import { ProofMesh } from '@proofmesh/sdk';

const client = new ProofMesh({
  apiKey: '${apiKey}',
  orgId: '${orgId}',
  // Optional: override for local dev / self-hosted
  // baseUrl: 'http://localhost:3000',
});`,
    stamp: `// 1) Create a proof from a File or Blob
const stamp = await client.stamp({
  file: fileBlob,
  artifactType: 'document',
  artifactId: 'invoice-2024-001',
});

console.log('Hash:', stamp.proof.hash);
console.log('Proof ID:', stamp.proof.id);`,
    verify: `// 2) Verify later by hash (fast DB-only check)
const verification = await client.verify({
  hash: stamp.proof.hash,
  // mode: 'db_plus_validators', // uncomment to ask live validators as well
});

console.log('Valid:', verification.isValid);
console.log('Verified by:', verification.validatorCount, 'validators');`,
    verifyFile: `// 3) Or verify directly from a file (no manual hashing)
const fileCheck = await client.verifyFile({
  file: fileBlob,
  mode: 'db_plus_validators',
});

console.log('File is valid:', fileCheck.isValid);`,
    listProofs: `// List recent proofs for this org
const { proofs } = await client.listProofs(50);

proofs.forEach((proof) => {
  console.log(\`\${proof.artifactId}: \${proof.hash}\`);
});`,
    quickStart: `import { ProofMesh } from '@proofmesh/sdk';

const client = new ProofMesh({
  apiKey: '${apiKey}',
  orgId: '${orgId}',
  // Optional: override for local dev / self-hosted
  // baseUrl: 'http://localhost:3000',
});

// 1) Create a proof from a File or Blob
const stamp = await client.stamp({
  file: fileBlob,
  artifactType: 'document',
  artifactId: 'invoice-2024-001',
});

console.log('Hash:', stamp.proof.hash);
console.log('Proof ID:', stamp.proof.id);

// 2) Verify later by hash (fast DB-only check)
const verification = await client.verify({
  hash: stamp.proof.hash,
  // mode: 'db_plus_validators', // uncomment to ask live validators as well
});

console.log('Valid:', verification.isValid);
console.log('Verified by:', verification.validatorCount, 'validators');

// 3) Or verify directly from a file (no manual hashing)
const fileCheck = await client.verifyFile({
  file: fileBlob,
  mode: 'db_plus_validators',
});

console.log('File is valid:', fileCheck.isValid);`
  },
  curl: {
    stamp: `# Stamp a hash for your org using an API key
curl -X POST https://api.proofmesh.com/api/stamp \\
  -H "x-api-key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "hash": "SHA256:abc123...",
    "artifactType": "document",
    "artifactId": "invoice-2024-001"
  }'`,
    verify: `# Verify a proof by hash (public endpoint)
curl -X POST https://api.proofmesh.com/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "hash": "SHA256:abc123...",
    "mode": "db_only"
  }'`,
    publicVerify: `# Public verification (no auth required, db + optional validators)
curl -X POST https://api.proofmesh.com/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "hash": "SHA256:abc123...",
    "mode": "db_plus_validators"
  }'`,
    listProofs: `# List all proofs for your org using an API key
curl -X GET "https://api.proofmesh.com/api/proofs?limit=50" \\
  -H "x-api-key: ${apiKey}"`
  }
});

export default function OrgSDK({ orgId }: OrgSDKProps) {
  const [language, setLanguage] = useState<'javascript' | 'curl'>('javascript');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  const apiKey = 'your-api-key-here'; // This will be replaced with actual key from API Keys page
  const codeExamples = getCodeExamples(orgId, apiKey);
  const currentCode: Record<string, string> = codeExamples[language] as Record<string, string>;

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(34, 197, 94, 0.1))' }}>
        <div className="card-title">
          <h2 className="flex items-center gap-3 text-2xl">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#22c55e] flex items-center justify-center">
              <Code className="w-6 h-6 text-[#020617]" />
            </div>
            <div>
              <div>SDK & API Documentation</div>
              <p className="text-sm text-[#9ca3af] font-normal mt-1">Integrate ProofMesh into your applications</p>
            </div>
          </h2>
          <Sparkles className="w-6 h-6 text-[#0ea5e9]" />
        </div>
      </div>

      {/* SDK Package Card */}
      <div className="bg-gradient-to-br from-[#0ea5e9]/10 via-[#22c55e]/10 to-[#8b5cf6]/10 border border-[#0ea5e9]/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#22c55e] flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold mb-2">Official JavaScript SDK</h3>
            <p className="text-sm text-[#9ca3af] mb-4">
              Use our TypeScript SDK for the best developer experience. Includes full type definitions, error handling, and all API methods.
            </p>
            <div className="flex flex-wrap gap-3">
              <code className="px-3 py-2 bg-[#020617] border border-[#1f2937] rounded-lg text-sm text-[#22c55e] font-mono">
                npm install @proofmesh/sdk
              </code>
              <a 
                href="https://github.com/proofmesh/sdk-js" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn-secondary text-sm flex items-center gap-2 px-4 py-2"
              >
                <ExternalLink className="w-4 h-4" />
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* API Key Notice */}
      <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-md bg-[#f59e0b] flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[#020617] text-xs font-bold">!</span>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Create an API Key First</p>
            <p className="text-sm text-[#9ca3af]">
              Go to the <a href={`/orgs/${orgId}/keys`} className="text-[#0ea5e9] hover:underline">API Keys</a> page to generate your authentication key, then replace <code className="text-[#f59e0b] bg-[#020617] px-2 py-1 rounded">your-api-key-here</code> in the examples below.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body space-y-6">
          {/* Language Selector */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => setLanguage('javascript')}
              className={language === 'javascript' ? 'tab active' : 'tab'}
            >
              <Terminal className="w-4 h-4" />
              JavaScript SDK
            </button>
            <button
              onClick={() => setLanguage('curl')}
              className={language === 'curl' ? 'tab active' : 'tab'}
            >
              <Terminal className="w-4 h-4" />
              cURL / REST API
            </button>
          </div>

          {/* Installation */}
          {'install' in currentCode && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#22c55e] flex items-center justify-center">
                    <span className="text-[#020617] text-xs font-bold">1</span>
                  </div>
                  Installation
                </h3>
                <button
                  onClick={() => copyToClipboard(currentCode.install, 'install')}
                  className="btn-secondary text-sm flex items-center gap-2 px-4 py-2"
                >
                  {copiedCode === 'install' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#0ea5e9] to-[#22c55e] rounded-xl opacity-20 blur group-hover:opacity-40 transition"></div>
                <pre className="relative bg-[#020617] border border-[#1f2937] rounded-xl p-6 overflow-x-auto">
                  <code className="text-sm text-[#22c55e] font-mono">{currentCode.install}</code>
                </pre>
              </div>
            </div>
          )}

          {/* Usage / Quick Start */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#0ea5e9] flex items-center justify-center">
                  <span className="text-[#020617] text-xs font-bold">2</span>
                </div>
                {language === 'javascript' ? 'Quick Start (Copy & Paste)' : 'Create a Proof'}
              </h3>
              <button
                onClick={() =>
                  copyToClipboard(
                    language === 'javascript' ? currentCode.quickStart : currentCode.stamp,
                    language === 'javascript' ? 'quickStart' : 'stamp'
                  )
                }
                className="btn-secondary text-sm flex items-center gap-2 px-4 py-2"
              >
                {copiedCode === (language === 'javascript' ? 'quickStart' : 'stamp') ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#0ea5e9] to-[#22c55e] rounded-xl opacity-20 blur group-hover:opacity-40 transition"></div>

              {language === 'javascript' ? (
                <div className="relative bg-[#020617] border border-[#1f2937] rounded-xl p-6 space-y-5">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">
                      Step 1 – Initialize the client
                    </p>
                    <pre className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                      <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">
                        {currentCode.init}
                      </code>
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">
                      Step 2 – Create a proof from a file
                    </p>
                    <pre className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                      <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">
                        {currentCode.stamp}
                      </code>
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">
                      Step 3 – Verify later by hash
                    </p>
                    <pre className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                      <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">
                        {currentCode.verify}
                      </code>
                    </pre>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">
                      Optional – Verify directly from a file
                    </p>
                    <pre className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                      <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">
                        {currentCode.verifyFile}
                      </code>
                    </pre>
                  </div>
                </div>
              ) : (
                <pre className="relative bg-[#020617] border border-[#1f2937] rounded-xl p-6 overflow-x-auto">
                  <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">
                    {currentCode.stamp}
                  </code>
                </pre>
              )}
            </div>
          </div>

          {/* Verify Example (cURL only – JS quick start already covers this) */}
          {'verify' in currentCode && language === 'curl' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#22c55e] flex items-center justify-center">
                    <span className="text-[#020617] text-xs font-bold">3</span>
                  </div>
                  Verify a Proof
                </h3>
                <button
                  onClick={() => copyToClipboard(currentCode.verify, 'verify')}
                  className="btn-secondary text-sm flex items-center gap-2 px-4 py-2"
                >
                  {copiedCode === 'verify' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#0ea5e9] to-[#22c55e] rounded-xl opacity-20 blur group-hover:opacity-40 transition"></div>
                <pre className="relative bg-[#020617] border border-[#1f2937] rounded-xl p-6 overflow-x-auto">
                <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">
                  {currentCode.verify}
                </code>
                </pre>
              </div>
            </div>
          )}

          {/* List Proofs (JS only) */}
          {language === 'javascript' && 'listProofs' in currentCode && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#8b5cf6] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">4</span>
                  </div>
                  List Proofs
                </h3>
                <button
                  onClick={() => copyToClipboard(currentCode.listProofs, 'listProofs')}
                  className="btn-secondary text-sm flex items-center gap-2 px-4 py-2"
                >
                  {copiedCode === 'listProofs' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#8b5cf6] to-[#22c55e] rounded-xl opacity-20 blur group-hover:opacity-40 transition"></div>
                <pre className="relative bg-[#020617] border border-[#1f2937] rounded-xl p-6 overflow-x-auto">
                  <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">
                    {currentCode.listProofs}
                  </code>
                </pre>
              </div>
            </div>
          )}

          {/* List Proofs cURL */}
          {language === 'curl' && 'listProofs' in currentCode && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#8b5cf6] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">4</span>
                  </div>
                  List Proofs
                </h3>
                <button
                  onClick={() => copyToClipboard(currentCode.listProofs, 'listProofs')}
                  className="btn-secondary text-sm flex items-center gap-2 px-4 py-2"
                >
                  {copiedCode === 'listProofs' ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#8b5cf6] to-[#22c55e] rounded-xl opacity-20 blur group-hover:opacity-40 transition"></div>
                <pre className="relative bg-[#020617] border border-[#1f2937] rounded-xl p-6 overflow-x-auto">
                  <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">
                    {currentCode.listProofs}
                  </code>
                </pre>
              </div>
            </div>
          )}

          {/* API Endpoints Reference */}
          <div className="relative overflow-hidden rounded-xl border border-[#1f2937] p-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#0ea5e9]/10 to-[#22c55e]/10 blur-3xl"></div>
            <div className="relative space-y-6">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#0ea5e9]" />
                API Endpoints
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-[#020617] rounded-lg border border-[#1f2937]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-[#22c55e] text-[#020617] text-xs font-bold rounded">POST</span>
                    <code className="text-sm text-[#22c55e]">/api/stamp</code>
                  </div>
                  <p className="text-sm text-[#9ca3af]">Create a cryptographic proof for a file</p>
                </div>

                <div className="p-4 bg-[#020617] rounded-lg border border-[#1f2937]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-[#0ea5e9] text-[#020617] text-xs font-bold rounded">POST</span>
                    <code className="text-sm text-[#0ea5e9]">/api/verify</code>
                  </div>
                  <p className="text-sm text-[#9ca3af]">Verify a proof with authentication</p>
                </div>

                <div className="p-4 bg-[#020617] rounded-lg border border-[#1f2937]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-[#8b5cf6] text-white text-xs font-bold rounded">POST</span>
                    <code className="text-sm text-[#8b5cf6]">/api/public-verify</code>
                  </div>
                  <p className="text-sm text-[#9ca3af]">Public verification endpoint (no auth required; supports optional live validators)</p>
                </div>

                <div className="p-4 bg-[#020617] rounded-lg border border-[#1f2937]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-[#f59e0b] text-[#020617] text-xs font-bold rounded">GET</span>
                    <code className="text-sm text-[#f59e0b]">/api/proofs</code>
                  </div>
                  <p className="text-sm text-[#9ca3af]">List all proofs for your organization</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Reference */}
          <div className="relative overflow-hidden rounded-xl border border-[#1f2937] p-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#0ea5e9]/10 to-[#22c55e]/10 blur-3xl"></div>
            <div className="relative space-y-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#0ea5e9]" />
                Quick Reference
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-[#6b7280] uppercase tracking-wider">Base URL</span>
                  <div className="code text-sm bg-[#020617] px-3 py-2 rounded-lg border border-[#1f2937]">
                    https://api.proofmesh.com
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-[#6b7280] uppercase tracking-wider">Authentication</span>
                  <div className="code text-sm bg-[#020617] px-3 py-2 rounded-lg border border-[#1f2937] space-y-1">
                    <div>x-api-key: your-org-api-key</div>
                    <div className="text-xs text-[#6b7280]">Org is derived from the key; no extra header needed.</div>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-[#6b7280] uppercase tracking-wider">Format</span>
                  <div className="code text-sm bg-[#020617] px-3 py-2 rounded-lg border border-[#1f2937]">
                    JSON / Multipart
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Response Examples */}
          <div className="relative overflow-hidden rounded-xl border border-[#1f2937] p-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#22c55e]/10 to-[#0ea5e9]/10 blur-3xl"></div>
            <div className="relative space-y-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Code className="w-5 h-5 text-[#22c55e]" />
                Example Responses
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-[#9ca3af] mb-2">Successful Stamp Response:</p>
                  <pre className="bg-[#020617] border border-[#1f2937] rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-[#22c55e] font-mono">{`{
  "id": "proof_abc123",
  "hash": "SHA256:d4735e3a265e16eee03f59718b9b5d03...",
  "orgId": "${orgId}",
  "artifactType": "document",
  "artifactId": "invoice-2024-001",
  "createdAt": "2024-11-23T00:00:00Z"
}`}</code>
                  </pre>
                </div>

                <div>
                  <p className="text-sm text-[#9ca3af] mb-2">Successful Verify Response:</p>
                  <pre className="bg-[#020617] border border-[#1f2937] rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-[#0ea5e9] font-mono">{`{
  "isValid": true,
  "validatorCount": 3,
  "proof": {
    "id": "proof_abc123",
    "hash": "SHA256:d4735e3a265e16eee03f59718b9b5d03...",
    "createdAt": "2024-11-23T00:00:00Z"
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
