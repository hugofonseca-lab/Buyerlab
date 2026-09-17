-- Additive: legacy execution payloads and report URLs remain intact.
CREATE TABLE IF NOT EXISTS materials(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scenario_templates(id TEXT NOT NULL, version TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(id,version));
CREATE TABLE IF NOT EXISTS market_snapshots(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scenario_instances(id TEXT PRIMARY KEY, payload TEXT NOT NULL, generation_metadata TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS supplier_candidates(id TEXT PRIMARY KEY, scenario_instance_id TEXT NOT NULL REFERENCES scenario_instances(id), public_payload TEXT NOT NULL, private_payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS supplier_switches(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES simulation_runs(id), payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS simulation_runs_owner_status ON simulation_runs(owner,status,created_at);
INSERT OR IGNORE INTO schema_migrations VALUES(2, datetime('now'));
