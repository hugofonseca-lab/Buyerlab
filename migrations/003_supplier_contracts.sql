-- Additive: hypothetical/mocked current contract with the incumbent supplier, per scenario instance.
CREATE TABLE IF NOT EXISTS supplier_contracts(id TEXT PRIMARY KEY, scenario_instance_id TEXT NOT NULL REFERENCES scenario_instances(id), payload TEXT NOT NULL);
INSERT OR IGNORE INTO schema_migrations VALUES(3, datetime('now'));
