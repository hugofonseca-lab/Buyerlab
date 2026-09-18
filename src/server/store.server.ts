import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type { StoredRun } from "./model";
import { blueprint } from "./scenario.server";
import { rules, deltas, profileWeights } from "./rules.server";
import { ALUMINUM_TEMPLATE, MATERIALS } from "./aluminum.server";
import { summarizeHistory } from "./history.server";
import type { HistoryResponse } from "../domain/aluminum";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const opaque = () => randomBytes(32).toString("base64url");

const MIGRATION_FILES = ["001_initial.sql", "002_aluminum.sql", "003_supplier_contracts.sql"];

/**
 * Persistência em Postgres (Supabase). Cada `Store` fica sobre um schema Postgres isolado — o
 * padrão "public" para desenvolvimento/produção, um schema descartável por execução de teste
 * (ver `tests/api.test.ts`). O schema é roteado via `search_path` da conexão, então todo o SQL
 * abaixo usa nomes de tabela simples, sem qualificar o schema explicitamente.
 */
export class Store {
  private constructor(
    /** Exposto para testes (`store.sql\`...\``); chamadores de produção usam os métodos abaixo. */
    readonly sql: postgres.Sql,
    readonly schema: string,
  ) {}

  // "||", não "??": plataformas de deploy costumam deixar uma variável opcional não preenchida
  // como string vazia em vez de omiti-la — precisa cair para "public" nesse caso também.
  static async create(schema = process.env["BUYERLAB_DB_SCHEMA"] || "public"): Promise<Store> {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL não configurada.");
    const sql = postgres(url, {
      // Exigido pelo pooler de transação do Supabase (porta 6543): cada instrução pode ir para
      // uma conexão física diferente, então prepared statements entre chamadas não funcionam.
      prepare: false,
      ssl: "require",
      max: 5,
      connection: schema === "public" ? {} : { search_path: schema },
    });
    if (schema !== "public") await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    // .simple() manda o arquivo inteiro (várias instruções) num único round-trip, em vez de uma
    // chamada por instrução — importante porque isso roda a cada Store.create() (todo cold start).
    for (const file of MIGRATION_FILES)
      await sql.unsafe(readFileSync(resolve("migrations", file), "utf8")).simple();
    const store = new Store(sql, schema);
    await store.seed();
    return store;
  }

  private async seed(): Promise<void> {
    const materialRows = MATERIALS.map((material) => ({
      id: material.id,
      payload: JSON.stringify(material),
    }));
    await this.sql`
      INSERT INTO materials ${this.sql(materialRows, "id", "payload")}
      ON CONFLICT DO NOTHING
    `;
    await this.sql`
      INSERT INTO scenario_templates VALUES (${ALUMINUM_TEMPLATE.id}, ${ALUMINUM_TEMPLATE.version}, ${JSON.stringify(ALUMINUM_TEMPLATE)})
      ON CONFLICT DO NOTHING
    `;
    await this.sql`
      INSERT INTO scenarios VALUES (${blueprint.id}, ${blueprint.versao}, ${JSON.stringify({ ...blueprint, rules, deltas, profileWeights })})
      ON CONFLICT DO NOTHING
    `;
  }

  /** Fecha a conexão. Em desenvolvimento/produção só é chamado ao encerrar o processo. */
  async close(): Promise<void> {
    await this.sql.end({ timeout: 5 });
  }

  /** Só para testes: apaga o schema descartável inteiro e fecha a conexão. */
  async destroy(): Promise<void> {
    if (this.schema !== "public")
      await this.sql.unsafe(`DROP SCHEMA IF EXISTS "${this.schema}" CASCADE`);
    await this.close();
  }

  async session(token: string | undefined): Promise<{ hash: string; token?: string }> {
    if (token && /^[\w-]{43}$/.test(token)) {
      const hash = digest(token);
      const rows = await this
        .sql`SELECT id FROM sessions WHERE id=${hash} AND expires_at>${Date.now()}`;
      if (rows.length > 0) return { hash };
    }
    const next = opaque(),
      hash = digest(next);
    await this
      .sql`INSERT INTO sessions VALUES (${hash}, ${Date.now()}, ${Date.now() + 30 * 86400000})`;
    return { hash, token: next };
  }

  async load(id: string, owner: string): Promise<StoredRun | null> {
    const rows = await this.sql<
      { payload: string }[]
    >`SELECT payload FROM simulation_runs WHERE id=${id} AND owner=${owner}`;
    return rows[0] ? (JSON.parse(rows[0].payload) as StoredRun) : null;
  }

  async save(
    stored: StoredRun,
    owner: string,
    client: postgres.Sql | postgres.TransactionSql = this.sql,
  ): Promise<void> {
    // Estático por instância (mercado, instância, candidatos, contrato): só muda na criação do
    // run ("preparacao"), então só tenta gravar nesse momento — evita round-trips repetidos a
    // cada turno para dados que nunca mudam depois.
    if (stored.run.status === "preparacao" && stored.aluminum && stored.sourcingPrivate) {
      const a = stored.aluminum;
      await client`
        INSERT INTO market_snapshots VALUES (${a.instance.market.id}, ${JSON.stringify(a.instance.market)})
        ON CONFLICT DO NOTHING
      `;
      await client`
        INSERT INTO scenario_instances VALUES (${a.instance.id}, ${JSON.stringify(a.instance)}, ${JSON.stringify(stored.sourcingPrivate.generationMetadata)})
        ON CONFLICT DO NOTHING
      `;
      const candidateRows = a.suppliers.map((supplier) => ({
        id: supplier.id,
        scenario_instance_id: a.instance.id,
        public_payload: JSON.stringify(supplier),
        private_payload: JSON.stringify(stored.sourcingPrivate!.supplierConfigs[supplier.id]),
      }));
      await client`
        INSERT INTO supplier_candidates ${client(candidateRows, "id", "scenario_instance_id", "public_payload", "private_payload")}
        ON CONFLICT DO NOTHING
      `;
      await client`
        INSERT INTO supplier_contracts VALUES (${a.currentContract.id}, ${a.instance.id}, ${JSON.stringify(a.currentContract)})
        ON CONFLICT DO NOTHING
      `;
    }
    const r = stored.run,
      turn = stored.estadoPublico.turno;
    await client`
      INSERT INTO simulation_runs VALUES (${r.id}, ${owner}, ${r.cenarioVersao}, ${r.engineVersao}, ${r.seed}, ${r.modo}, ${r.dificuldade}, ${stored.privateState.perfil}, ${turn}, ${r.status}, ${JSON.stringify(stored)}, ${r.criadoEm}, ${new Date().toISOString()})
      ON CONFLICT (id) DO UPDATE SET
        turn=excluded.turn, status=excluded.status, payload=excluded.payload, updated_at=excluded.updated_at
      WHERE simulation_runs.owner = excluded.owner
    `;
    if (stored.mensagens.length > 0) {
      const messageRows = stored.mensagens.map((m) => ({
        id: m.id,
        run_id: r.id,
        turn: m.turno,
        payload: JSON.stringify(m),
      }));
      await client`
        INSERT INTO messages ${client(messageRows, "id", "run_id", "turn", "payload")}
        ON CONFLICT DO NOTHING
      `;
    }
    await client`
      INSERT INTO state_snapshots VALUES (${r.id}, ${turn}, ${JSON.stringify({
        public: stored.estadoPublico,
        private: stored.privateState,
        disclosures: stored.disclosures,
        providerMode: stored.providerMode,
      })})
      ON CONFLICT (run_id, turn) DO UPDATE SET payload=excluded.payload
    `;
    if (stored.audit.length > 0) {
      const eventRows = stored.audit.map((e) => ({
        run_id: r.id,
        event_id: e.id,
        turn: e.turno,
        probability: e.probabilidade,
        draw: e.sorteio,
        occurred: e.ocorreu,
      }));
      await client`
        INSERT INTO simulation_events ${client(eventRows, "run_id", "event_id", "turn", "probability", "draw", "occurred")}
        ON CONFLICT DO NOTHING
      `;
    }
    if (stored.propostaFinal)
      await client`
        INSERT INTO final_offers VALUES (${r.id}, ${JSON.stringify(stored.propostaFinal)})
        ON CONFLICT (run_id) DO UPDATE SET payload=excluded.payload
      `;
    if (stored.relatorio)
      await client`
        INSERT INTO evaluations VALUES (${r.id}, ${JSON.stringify(stored.relatorio)})
        ON CONFLICT (run_id) DO UPDATE SET payload=excluded.payload
      `;
    for (const change of stored.aluminum?.switches ?? [])
      await client`
        INSERT INTO supplier_switches VALUES (${change.id}, ${r.id}, ${JSON.stringify(change)})
        ON CONFLICT DO NOTHING
      `;
  }

  async history(owner: string): Promise<HistoryResponse> {
    const rows = await this.sql<{ payload: string }[]>`
      SELECT payload FROM simulation_runs WHERE owner=${owner} AND status='concluida' ORDER BY created_at DESC
    `;
    return summarizeHistory(rows.map((row) => JSON.parse(row.payload) as StoredRun));
  }

  async cached(
    owner: string,
    key: string,
    fingerprint: string,
  ): Promise<{ found: boolean; value?: unknown }> {
    const rows = await this.sql<{ fingerprint: string; response: string }[]>`
      SELECT fingerprint, response FROM idempotency WHERE owner=${owner} AND key=${key}
    `;
    const row = rows[0];
    if (!row) return { found: false };
    if (row.fingerprint !== fingerprint)
      throw new Error("Chave de idempotência reutilizada com conteúdo diferente.");
    return { found: true, value: JSON.parse(row.response) as unknown };
  }

  /** Envolve `action` numa transação Postgres real; commit/rollback automáticos. */
  async transaction(action: (client: postgres.TransactionSql) => Promise<void>): Promise<void> {
    await this.sql.begin(action);
  }

  async remember(
    owner: string,
    key: string,
    fingerprint: string,
    value: unknown,
    client: postgres.Sql | postgres.TransactionSql = this.sql,
  ): Promise<void> {
    await client`INSERT INTO idempotency VALUES (${owner}, ${key}, ${fingerprint}, ${JSON.stringify(value ?? null)})`;
  }

  /**
   * Janela fixa de 1 minuto. Limpeza de janelas antigas e incremento/leitura atômicos num único
   * round-trip (CTE de escrita) — cada requisição chama isso duas vezes (bucket global e de
   * sessão), então o custo por chamada importa de verdade em ambiente serverless.
   */
  async rate(bucket: string, limit: number): Promise<boolean> {
    const window = Math.floor(Date.now() / 60000);
    const rows = await this.sql<{ count: number }[]>`
      WITH cleanup AS (
        DELETE FROM rate_limits WHERE window_minute < ${window - 2}
      )
      INSERT INTO rate_limits VALUES (${bucket}, ${window}, 1)
      ON CONFLICT (bucket, window_minute) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count
    `;
    return rows[0]!.count <= limit;
  }

  async share(
    runId: string,
    client: postgres.Sql | postgres.TransactionSql = this.sql,
  ): Promise<string> {
    const token = opaque();
    await client`INSERT INTO share_tokens VALUES (${digest(token)}, ${runId}, ${Date.now() + 7 * 86400000})`;
    return token;
  }

  async report(token: string): Promise<unknown> {
    const rows = await this.sql<{ payload: string }[]>`
      SELECT e.payload FROM evaluations e JOIN share_tokens s ON s.run_id=e.run_id
      WHERE s.token_hash=${digest(token)} AND s.expires_at>${Date.now()}
    `;
    return rows[0] ? (JSON.parse(rows[0].payload) as unknown) : null;
  }
}
