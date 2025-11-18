INSERT INTO validators (id, name, region, api_key_hash, enabled)
VALUES ('val_us_dev_01', 'Dev Validator 1', 'us-dev', 'dev-secret', true)
ON CONFLICT (id) DO NOTHING;


