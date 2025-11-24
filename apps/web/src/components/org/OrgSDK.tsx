import { useState } from 'react';
import { Code, Copy, Check, Sparkles, Terminal, BookOpen, ExternalLink, Package } from 'lucide-react';

interface OrgSDKProps {
  orgId: string;
}

const getCodeExamples = (orgId: string, apiKey: string) => ({
  javascript: {
    install: `npm install @proofmesh/sdk`,
    usage: `import { ProofMesh } from '@proofmesh/sdk';

const client = new ProofMesh({
  apiKey: '${apiKey}',
  orgId: '${orgId}'
});

// Create a proof
const proof = await client.stamp({
  file: fileBlob,
  artifactType: 'document',
  artifactId: 'invoice-2024-001'
});

console.log('Hash:', proof.hash);
console.log('Proof ID:', proof.id);`,
    verify: `// Verify a proof
const verification = await client.verify({
  hash: 'SHA256:abc123...'
});

console.log('Valid:', verification.isValid);
console.log('Verified by:', verification.validatorCount, 'validators');

// Public verification (no auth needed)
const publicCheck = await client.publicVerify('SHA256:abc123...');
console.log('Publicly valid:', publicCheck.isValid);`,
    listProofs: `// List all proofs
const { proofs } = await client.listProofs(50);

proofs.forEach(proof => {
  console.log(\`\${proof.artifactId}: \${proof.hash}\`);
});`
  },
  curl: {
    stamp: `# Stamp a file to create a verifiable proof
curl -X POST https://your-api.proofmesh.com/api/stamp \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "X-Org-ID: ${orgId}" \\
  -F "file=@document.pdf" \\
  -F "artifactType=document" \\
  -F "artifactId=invoice-2024-001"`,
    verify: `# Verify a proof
curl -X POST https://your-api.proofmesh.com/api/verify \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "hash": "SHA256:abc123...",
    "orgId": "${orgId}"
  }'`,
    publicVerify: `# Public verification (no auth required)
curl -X POST https://your-api.proofmesh.com/api/public-verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "hash": "SHA256:abc123..."
  }'`,
    listProofs: `# List all proofs
curl -X GET "https://your-api.proofmesh.com/api/proofs?limit=50" \\
  -H "Authorization: Bearer ${apiKey}"`
  }
});

export default function OrgSDK({ orgId }: OrgSDKProps) {
  const [language, setLanguage] = useState<'javascript' | 'curl'>('javascript');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  const apiKey = 'your-api-key-here'; // This will be replaced with actual key from API Keys page
  const codeExamples = getCodeExamples(orgId, apiKey);

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
          {'install' in codeExamples[language] && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#22c55e] flex items-center justify-center">
                    <span className="text-[#020617] text-xs font-bold">1</span>
                  </div>
                  Installation
                </h3>
                <button
                  onClick={() => copyToClipboard((codeExamples[language] as any).install, 'install')}
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
                  <code className="text-sm text-[#22c55e] font-mono">{(codeExamples[language] as any).install}</code>
                </pre>
              </div>
            </div>
          )}

          {/* Usage/Stamp Example */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#0ea5e9] flex items-center justify-center">
                  <span className="text-[#020617] text-xs font-bold">2</span>
                </div>
                {language === 'javascript' ? 'Quick Start' : 'Create a Proof'}
              </h3>
              <button
                onClick={() => copyToClipboard((codeExamples[language] as any)[language === 'javascript' ? 'usage' : 'stamp'], language === 'javascript' ? 'usage' : 'stamp')}
                className="btn-secondary text-sm flex items-center gap-2 px-4 py-2"
              >
                {copiedCode === (language === 'javascript' ? 'usage' : 'stamp') ? (
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
                <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">{(codeExamples[language] as any)[language === 'javascript' ? 'usage' : 'stamp']}</code>
              </pre>
            </div>
          </div>

          {/* Verify Example */}
          {'verify' in codeExamples[language] && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#22c55e] flex items-center justify-center">
                    <span className="text-[#020617] text-xs font-bold">3</span>
                  </div>
                  Verify a Proof
                </h3>
                <button
                  onClick={() => copyToClipboard((codeExamples[language] as any).verify, 'verify')}
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
                  <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">{(codeExamples[language] as any).verify}</code>
                </pre>
              </div>
            </div>
          )}

          {/* List Proofs (JS only) */}
          {language === 'javascript' && 'listProofs' in codeExamples[language] && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#8b5cf6] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">4</span>
                  </div>
                  List Proofs
                </h3>
                <button
                  onClick={() => copyToClipboard((codeExamples[language] as any).listProofs, 'listProofs')}
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
                  <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">{(codeExamples[language] as any).listProofs}</code>
                </pre>
              </div>
            </div>
          )}

          {/* List Proofs cURL */}
          {language === 'curl' && 'listProofs' in codeExamples[language] && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#8b5cf6] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">4</span>
                  </div>
                  List Proofs
                </h3>
                <button
                  onClick={() => copyToClipboard((codeExamples[language] as any).listProofs, 'listProofs')}
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
                  <code className="text-sm text-[#e5e7eb] font-mono leading-relaxed">{(codeExamples[language] as any).listProofs}</code>
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
                  <p className="text-sm text-[#9ca3af]">Public verification endpoint (no auth required)</p>
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
                    https://your-api.proofmesh.com
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-[#6b7280] uppercase tracking-wider">Authentication</span>
                  <div className="code text-sm bg-[#020617] px-3 py-2 rounded-lg border border-[#1f2937]">
                    Bearer Token (API Key)
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-[#6b7280] uppercase tracking-wider">Org Header</span>
                  <div className="code text-sm bg-[#020617] px-3 py-2 rounded-lg border border-[#1f2937]">
                    X-Org-ID: {orgId}
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
