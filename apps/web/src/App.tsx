import React, { useState } from 'react';
import { StampPage } from './StampPage';
import { VerifyPage } from './VerifyPage';
import { ProofsPage } from './ProofsPage';

type Tab = 'stamp' | 'verify' | 'proofs';

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('stamp');

  return (
    <div className="app">
      <header className="app-header">
        <h1>ProofMesh Dev UI</h1>
        <p>Stamp and verify file hashes against the ProofMesh API.</p>
      </header>
      <nav className="tabs">
        <button
          type="button"
          className={tab === 'stamp' ? 'tab active' : 'tab'}
          onClick={() => setTab('stamp')}
        >
          Stamp
        </button>
        <button
          type="button"
          className={tab === 'verify' ? 'tab active' : 'tab'}
          onClick={() => setTab('verify')}
        >
          Verify
        </button>
        <button
          type="button"
          className={tab === 'proofs' ? 'tab active' : 'tab'}
          onClick={() => setTab('proofs')}
        >
          Proofs
        </button>
      </nav>
      <main className="app-main">
        {tab === 'stamp' && <StampPage />}
        {tab === 'verify' && <VerifyPage />}
        {tab === 'proofs' && <ProofsPage />}
      </main>
    </div>
  );
};


