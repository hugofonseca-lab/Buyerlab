-- Additive: legacy execution payloads and report URLs remain intact.
CREATE TABLE IF NOT EXISTS materials(id text PRIMARY KEY, payload text NOT NULL);
CREATE TABLE IF NOT EXISTS scenario_templates(id text NOT NULL, version text NOT NULL, payload text NOT NULL, PRIMARY KEY(id,version));
CREATE TABLE IF NOT EXISTS market_snapshots(id text PRIMARY KEY, payload text NOT NULL);
CREATE TABLE IF NOT EXISTS scenario_instances(id text PRIMARY KEY, payload text NOT NULL, generation_metadata text NOT NULL);
CREATE TABLE IF NOT EXISTS supplier_candidates(id text PRIMARY KEY, scenario_instance_id text NOT NULL REFERENCES scenario_instances(id), public_payload text NOT NULL, private_payload text NOT NULL);
CREATE TABLE IF NOT EXISTS supplier_switches(id text PRIMARY KEY, run_id text NOT NULL REFERENCES simulation_runs(id), payload text NOT NULL);
CREATE INDEX IF NOT EXISTS simulation_runs_owner_status ON simulation_runs(owner,status,created_at);
INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
