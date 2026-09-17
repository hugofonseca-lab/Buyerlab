import { test, expect } from "@playwright/test";
import { toLovableSnapshot } from "../src/simulation/lovable-view";
import type { RunSnapshot } from "../src/domain/types";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const { PNG } = require(
  join(dirname(require.resolve("playwright-core/package.json")), "lib/utilsBundle.js"),
) as {
  PNG: { sync: { read(buffer: Buffer): { width: number; height: number; data: Buffer } } };
};
function compareLayout(actual: Buffer, expected: Buffer, label: string) {
  const a = PNG.sync.read(actual),
    b = PNG.sync.read(expected);
  expect.soft([a.width, a.height], `${label}: dimensões`).toEqual([b.width, b.height]);
  if (a.width !== b.width || a.height !== b.height) return;
  let different = 0;
  for (let i = 0; i < a.data.length; i += 4)
    if ([0, 1, 2].some((c) => Math.abs(a.data[i + c]! - b.data[i + c]!) > 2)) different++;
  // Up to 0.005% permits isolated glyph antialiasing; geometry must match exactly.
  expect.soft(different / (a.width * a.height), label).toBeLessThanOrEqual(0.00005);
}

test("home corresponde à referência atual do GitHub", async ({ page, context }, testInfo) => {
  const reference = process.env["LOVABLE_REFERENCE_URL"];
  test.skip(
    !reference,
    "Defina LOVABLE_REFERENCE_URL para comparar com a cópia isolada do GitHub.",
  );
  const original = await context.newPage();
  await original.goto(reference!);
  await page.goto("/");
  for (const item of [original, page]) {
    await expect(item.getByRole("heading", { name: "BuyerLab", exact: true })).toBeVisible();
    await item.evaluate(() => document.fonts.ready);
  }
  const expected = await original.screenshot({ fullPage: true, animations: "disabled" });
  const actual = await page.screenshot({ fullPage: true, animations: "disabled" });
  await testInfo.attach("github-reference", { body: expected, contentType: "image/png" });
  await testInfo.attach("local-interface", { body: actual, contentType: "image/png" });
  expect(actual.equals(expected), "A captura local deve corresponder à referência do GitHub").toBe(
    true,
  );
  await original.close();
});

test("dossiê e chat seguem a referência com os mesmos dados públicos", async ({
  page,
  context,
}, testInfo) => {
  const reference = process.env["LOVABLE_REFERENCE_URL"];
  test.skip(!reference, "Defina LOVABLE_REFERENCE_URL para comparar as telas.");
  await page.goto("/configurar?cenario=aluminum&material=6061-T6&seed=LAYOUT&perfil=colaborativo");
  await page.getByRole("button", { name: "Iniciar simulação" }).click();
  await expect(page).toHaveURL(/preparacao/);
  const id = page.url().split("/").at(-1)!;
  const snapshot: RunSnapshot = await (await page.request.get(`/api/simulations/${id}`)).json();
  const view = toLovableSnapshot(snapshot);
  const original = await context.newPage();
  await original.addInitScript((data) => {
    localStorage.setItem(
      `buyerlab.run.${data.run.id}`,
      JSON.stringify({
        ...data,
        schemaVersion: 2,
        initialSupplierId: data.activeSupplierId,
        conversations: [
          {
            supplierId: data.activeSupplierId,
            publicState: data.estadoPublico,
            messages: data.mensagens,
          },
        ],
        privateStates: {},
      }),
    );
  }, view);
  await original.goto(`${reference}/preparacao/${id}`);
  // Market provenance was intentionally added after this pinned Lovable reference.
  // The current market panel is checked by aluminum.spec.ts instead.
  for (const tab of ["Resumo da missão", "Fornecedores", "Qualidade e riscos"]) {
    for (const item of [page, original]) {
      await expect(item.getByRole("heading", { name: "Prepare sua estratégia" })).toBeVisible();
      await item.getByRole("button", { name: tab, exact: true }).click();
      await item.evaluate(() => document.fonts.ready);
      await item.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    }
    const expected = await original.screenshot({
      fullPage: true,
      animations: "disabled",
      path: testInfo.outputPath(`github-${tab}.png`),
    });
    const actual = await page.screenshot({
      fullPage: true,
      animations: "disabled",
      path: testInfo.outputPath(`local-${tab}.png`),
    });
    await testInfo.attach(`github-${tab}`, { body: expected, contentType: "image/png" });
    await testInfo.attach(`local-${tab}`, { body: actual, contentType: "image/png" });
    compareLayout(actual, expected, `Layout do dossiê: ${tab}`);
  }
  for (const [item, base] of [
    [page, ""],
    [original, reference!],
  ] as const) {
    await item.goto(`${base}/negociacao/${id}`);
    await expect(item.getByRole("heading", { name: /Conversa com/ })).toBeVisible();
    await item.evaluate(() => document.fonts.ready);
    await item.evaluate(() => window.scrollTo(0, 0));
  }
  // Operational copy differs because local notes are stored on the server.
  const expected = await original.screenshot({
    fullPage: true,
    animations: "disabled",
    path: testInfo.outputPath("github-chat.png"),
    mask: [original.getByText("Somente você vê estas notas. Elas permanecem neste navegador.")],
  });
  const actual = await page.screenshot({
    fullPage: true,
    animations: "disabled",
    path: testInfo.outputPath("local-chat.png"),
    mask: [page.getByText("Somente sua sessão vê estas notas. Elas são salvas no servidor.")],
  });
  await testInfo.attach("github-chat", { body: expected, contentType: "image/png" });
  await testInfo.attach("local-chat", { body: actual, contentType: "image/png" });
  compareLayout(actual, expected, "Layout da negociação");
  await original.close();
});
