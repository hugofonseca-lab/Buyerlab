/**
 * Conteúdo das migrations embutido como string, em vez de lido de `migrations/*.sql` em tempo de
 * execução (`readFileSync`) — uma função serverless (Vercel) não empacota arquivos que não sejam
 * importados por algum módulo, e ferramentas fora do bundler do Vite (ex.: `tsx`, usado por
 * `scripts/migrate.ts`) não entendem sufixos de import como `?raw`. String literal simples
 * funciona em qualquer ambiente sem plugin/loader especial. Mantenha em sincronia manualmente com
 * os arquivos em `migrations/*.sql`, que continuam sendo a referência legível/documentada.
 */
export const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS scenarios(id text NOT NULL, version text NOT NULL, blueprint text NOT NULL, PRIMARY KEY(id, version));
CREATE TABLE IF NOT EXISTS sessions(id text PRIMARY KEY, created_at bigint NOT NULL, expires_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS simulation_runs(id text PRIMARY KEY, owner text NOT NULL REFERENCES sessions(id), scenario_version text NOT NULL, engine_version text NOT NULL, seed text NOT NULL, mode text NOT NULL, difficulty text NOT NULL, profile text NOT NULL, turn integer NOT NULL, status text NOT NULL, payload text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL);
CREATE TABLE IF NOT EXISTS messages(id text PRIMARY KEY, run_id text NOT NULL REFERENCES simulation_runs(id), turn integer NOT NULL, payload text NOT NULL);
CREATE TABLE IF NOT EXISTS state_snapshots(run_id text NOT NULL REFERENCES simulation_runs(id), turn integer NOT NULL, payload text NOT NULL, PRIMARY KEY(run_id, turn));
CREATE TABLE IF NOT EXISTS simulation_events(run_id text NOT NULL REFERENCES simulation_runs(id), event_id text NOT NULL, turn integer NOT NULL, probability double precision NOT NULL, draw double precision NOT NULL, occurred boolean NOT NULL, PRIMARY KEY(run_id, event_id, turn));
CREATE TABLE IF NOT EXISTS final_offers(run_id text PRIMARY KEY REFERENCES simulation_runs(id), payload text NOT NULL);
CREATE TABLE IF NOT EXISTS evaluations(run_id text PRIMARY KEY REFERENCES simulation_runs(id), payload text NOT NULL);
CREATE TABLE IF NOT EXISTS share_tokens(token_hash text PRIMARY KEY, run_id text NOT NULL REFERENCES simulation_runs(id), expires_at bigint NOT NULL);
CREATE TABLE IF NOT EXISTS idempotency(owner text NOT NULL REFERENCES sessions(id), key text NOT NULL, fingerprint text NOT NULL, response text NOT NULL, PRIMARY KEY(owner,key));
CREATE TABLE IF NOT EXISTS rate_limits(bucket text NOT NULL, window_minute bigint NOT NULL, count integer NOT NULL, PRIMARY KEY(bucket,window_minute));
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
`,
  `CREATE TABLE IF NOT EXISTS materials(id text PRIMARY KEY, payload text NOT NULL);
CREATE TABLE IF NOT EXISTS scenario_templates(id text NOT NULL, version text NOT NULL, payload text NOT NULL, PRIMARY KEY(id,version));
CREATE TABLE IF NOT EXISTS market_snapshots(id text PRIMARY KEY, payload text NOT NULL);
CREATE TABLE IF NOT EXISTS scenario_instances(id text PRIMARY KEY, payload text NOT NULL, generation_metadata text NOT NULL);
CREATE TABLE IF NOT EXISTS supplier_candidates(id text PRIMARY KEY, scenario_instance_id text NOT NULL REFERENCES scenario_instances(id), public_payload text NOT NULL, private_payload text NOT NULL);
CREATE TABLE IF NOT EXISTS supplier_switches(id text PRIMARY KEY, run_id text NOT NULL REFERENCES simulation_runs(id), payload text NOT NULL);
CREATE INDEX IF NOT EXISTS simulation_runs_owner_status ON simulation_runs(owner,status,created_at);
INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
`,
  `CREATE TABLE IF NOT EXISTS supplier_contracts(id text PRIMARY KEY, scenario_instance_id text NOT NULL REFERENCES scenario_instances(id), payload text NOT NULL);
INSERT INTO schema_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
`,
];
