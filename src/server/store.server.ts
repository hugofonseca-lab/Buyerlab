import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type { StoredRun } from "./model";
import { blueprint } from "./scenario.server";
import { rules, deltas, profileWeights } from "./rules.server";
import { ALUMINUM_TEMPLATE, MATERIALS } from "./aluminum.server";
import { summarizeHistory } from "./history.server";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const opaque = () => randomBytes(32).toString("base64url");
export class Store {
  db: DatabaseSync;
  constructor(path = process.env["BUYERLAB_DB_PATH"] ?? ".data/buyerlab.sqlite") {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec(readFileSync(resolve("migrations/001_initial.sql"), "utf8"));
    this.db.exec(readFileSync(resolve("migrations/002_aluminum.sql"), "utf8"));
    this.db.exec(readFileSync(resolve("migrations/003_supplier_contracts.sql"), "utf8"));
    for (const material of MATERIALS)
      this.db
        .prepare("INSERT OR IGNORE INTO materials VALUES(?,?)")
        .run(material.id, JSON.stringify(material));
    this.db
      .prepare("INSERT OR IGNORE INTO scenario_templates VALUES(?,?,?)")
      .run(ALUMINUM_TEMPLATE.id, ALUMINUM_TEMPLATE.version, JSON.stringify(ALUMINUM_TEMPLATE));
    this.db
      .prepare("INSERT OR IGNORE INTO scenarios VALUES(?,?,?)")
      .run(
        blueprint.id,
        blueprint.versao,
        JSON.stringify({ ...blueprint, rules, deltas, profileWeights }),
      );
  }
  session(token: string | undefined): { hash: string; token?: string } {
    if (token && /^[\w-]{43}$/.test(token)) {
      const hash = digest(token);
      if (
        this.db.prepare("SELECT id FROM sessions WHERE id=? AND expires_at>?").get(hash, Date.now())
      )
        return { hash };
    }
    const next = opaque(),
      hash = digest(next);
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(hash, Date.now(), Date.now() + 30 * 86400000);
    return { hash, token: next };
  }
  load(id: string, owner: string): StoredRun | null {
    const row = this.db
      .prepare("SELECT payload FROM simulation_runs WHERE id=? AND owner=?")
      .get(id, owner) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as StoredRun) : null;
  }
  save(stored: StoredRun, owner: string): void {
    if (stored.aluminum && stored.sourcingPrivate) {
      const a = stored.aluminum;
      this.db
        .prepare("INSERT OR IGNORE INTO market_snapshots VALUES(?,?)")
        .run(a.instance.market.id, JSON.stringify(a.instance.market));
      this.db
        .prepare("INSERT OR IGNORE INTO scenario_instances VALUES(?,?,?)")
        .run(
          a.instance.id,
          JSON.stringify(a.instance),
          JSON.stringify(stored.sourcingPrivate.generationMetadata),
        );
      for (const supplier of a.suppliers)
        this.db
          .prepare("INSERT OR IGNORE INTO supplier_candidates VALUES(?,?,?,?)")
          .run(
            supplier.id,
            a.instance.id,
            JSON.stringify(supplier),
            JSON.stringify(stored.sourcingPrivate.supplierConfigs[supplier.id]),
          );
      this.db
        .prepare("INSERT OR IGNORE INTO supplier_contracts VALUES(?,?,?)")
        .run(a.currentContract.id, a.instance.id, JSON.stringify(a.currentContract));
    }
    const r = stored.run,
      turn = stored.estadoPublico.turno;
    this.db
      .prepare(
        "INSERT INTO simulation_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET turn=excluded.turn,status=excluded.status,payload=excluded.payload,updated_at=excluded.updated_at WHERE simulation_runs.owner=excluded.owner",
      )
      .run(
        r.id,
        owner,
        r.cenarioVersao,
        r.engineVersao,
        r.seed,
        r.modo,
        r.dificuldade,
        stored.privateState.perfil,
        turn,
        r.status,
        JSON.stringify(stored),
        r.criadoEm,
        new Date().toISOString(),
      );
    for (const m of stored.mensagens)
      this.db
        .prepare("INSERT OR IGNORE INTO messages VALUES(?,?,?,?)")
        .run(m.id, r.id, m.turno, JSON.stringify(m));
    this.db.prepare("INSERT OR REPLACE INTO state_snapshots VALUES(?,?,?)").run(
      r.id,
      turn,
      JSON.stringify({
        public: stored.estadoPublico,
        private: stored.privateState,
        disclosures: stored.disclosures,
        providerMode: stored.providerMode,
      }),
    );
    for (const e of stored.audit)
      this.db
        .prepare("INSERT OR IGNORE INTO simulation_events VALUES(?,?,?,?,?,?)")
        .run(r.id, e.id, e.turno, e.probabilidade, e.sorteio, Number(e.ocorreu));
    if (stored.propostaFinal)
      this.db
        .prepare("INSERT OR REPLACE INTO final_offers VALUES(?,?)")
        .run(r.id, JSON.stringify(stored.propostaFinal));
    if (stored.relatorio)
      this.db
        .prepare("INSERT OR REPLACE INTO evaluations VALUES(?,?)")
        .run(r.id, JSON.stringify(stored.relatorio));
    for (const change of stored.aluminum?.switches ?? [])
      this.db
        .prepare("INSERT OR IGNORE INTO supplier_switches VALUES(?,?,?)")
        .run(change.id, r.id, JSON.stringify(change));
  }
  history(owner: string) {
    const rows = this.db
      .prepare(
        "SELECT payload FROM simulation_runs WHERE owner=? AND status='concluida' ORDER BY created_at DESC",
      )
      .all(owner) as { payload: string }[];
    return summarizeHistory(rows.map((row) => JSON.parse(row.payload) as StoredRun));
  }
  cached(owner: string, key: string, fingerprint: string): { found: boolean; value?: unknown } {
    const row = this.db
      .prepare("SELECT fingerprint,response FROM idempotency WHERE owner=? AND key=?")
      .get(owner, key) as { fingerprint: string; response: string } | undefined;
    if (!row) return { found: false };
    if (row.fingerprint !== fingerprint)
      throw new Error("Chave de idempotência reutilizada com conteúdo diferente.");
    return { found: true, value: JSON.parse(row.response) as unknown };
  }
  transaction(action: () => void): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      action();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  remember(owner: string, key: string, fingerprint: string, value: unknown): void {
    this.db
      .prepare("INSERT INTO idempotency VALUES(?,?,?,?)")
      .run(owner, key, fingerprint, JSON.stringify(value ?? null));
  }
  rate(bucket: string, limit: number): boolean {
    const window = Math.floor(Date.now() / 60000);
    this.db.prepare("DELETE FROM rate_limits WHERE window<?").run(window - 2);
    this.db
      .prepare(
        "INSERT INTO rate_limits VALUES(?,?,1) ON CONFLICT(bucket,window) DO UPDATE SET count=count+1",
      )
      .run(bucket, window);
    const row = this.db
      .prepare("SELECT count FROM rate_limits WHERE bucket=? AND window=?")
      .get(bucket, window) as { count: number };
    return row.count <= limit;
  }
  share(runId: string): string {
    const token = opaque();
    this.db
      .prepare("INSERT INTO share_tokens VALUES(?,?,?)")
      .run(digest(token), runId, Date.now() + 7 * 86400000);
    return token;
  }
  report(token: string): unknown {
    const row = this.db
      .prepare(
        "SELECT e.payload FROM evaluations e JOIN share_tokens s ON s.run_id=e.run_id WHERE s.token_hash=? AND s.expires_at>?",
      )
      .get(digest(token), Date.now()) as { payload: string } | undefined;
    return row ? (JSON.parse(row.payload) as unknown) : null;
  }
}
