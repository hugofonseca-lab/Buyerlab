import { Store } from "../src/server/store.server";
const store = await Store.create();
try {
  console.log("Migrations aplicadas com sucesso (ver migrations/*.sql).");
} finally {
  await store.close();
}
