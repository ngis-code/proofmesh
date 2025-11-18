export type ProofStatus = 'pending' | 'confirmed' | 'failed';

export interface Org {
  id: string;
  name: string;
  created_at: string;
}

export interface Validator {
  id: string;
  name: string;
  region: string;
  api_key_hash: string;
  enabled: boolean;
  created_at: string;
  online: boolean;
  last_seen_at: string | null;
}

export interface Proof {
  id: string;
  org_id: string;
  hash: string;
  artifact_type: string;
  artifact_id: string | null;
  version_of: string | null;
  status: ProofStatus;
  created_at: string;
}

export type ValidatorResult = 'valid' | 'invalid' | 'unknown' | 'error';

export interface ValidatorRun {
  id: string;
  proof_id: string;
  validator_id: string;
  result: ValidatorResult;
  signature: string | null;
  signed_at: string;
  latency_ms: number | null;
}

export type MqttCommandType = 'STAMP' | 'VERIFY';
export type MqttResultType = 'STAMP_RESULT' | 'VERIFY_RESULT';

export interface StampCommandPayload {
  type: 'STAMP';
  proofId: string;
  orgId: string;
  hash: string;
}

export interface VerifyCommandPayload {
  type: 'VERIFY';
  proofId: string | null;
  orgId: string;
  hash: string;
}

export interface BaseResultPayload {
  proofId: string;
  validatorId: string;
  result: ValidatorResult;
  timestamp: string;
  signature: string;
}

export interface StampResultPayload extends BaseResultPayload {
  type: 'STAMP_RESULT';
}

export interface VerifyResultPayload extends BaseResultPayload {
  type: 'VERIFY_RESULT';
}

export type CommandPayload = StampCommandPayload | VerifyCommandPayload;
export type ResultPayload = StampResultPayload | VerifyResultPayload;

export interface ValidatorPresencePayload {
  validatorId: string;
  status: 'online' | 'offline';
  timestamp: string;
}


