-- Additive: hypothetical/mocked current contract with the incumbent supplier, per scenario instance.
CREATE TABLE IF NOT EXISTS supplier_contracts(id text PRIMARY KEY, scenario_instance_id text NOT NULL REFERENCES scenario_instances(id), payload text NOT NULL);
INSERT INTO schema_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
