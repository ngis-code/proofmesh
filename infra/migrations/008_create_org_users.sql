-- Map Appwrite users to orgs with roles (admin, viewer, etc.).

CREATE TABLE IF NOT EXISTS org_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  user_id STRING NOT NULL,
  role STRING NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_users_org_user ON org_users(org_id, user_id);


