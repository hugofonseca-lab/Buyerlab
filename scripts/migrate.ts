import { Store } from "../src/server/store.server";
const store = new Store();
try {
  console.log(
    "Migrations aplicadas:",
    store.db.prepare("SELECT version FROM schema_migrations ORDER BY version").all(),
  );
} finally {
  store.db.close();
}
