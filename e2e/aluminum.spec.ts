import { test, expect } from "@playwright/test";

test("alumínio: comparação, troca, retomada, diagnóstico e histórico", async ({ page }) => {
  await page.goto(
    "/configurar?cenario=aluminum&material=6061-T6&perfil=colaborativo&dif=iniciante&urgencia=baixa&seed=AL-DEMO",
  );
  await page.getByRole("button", { name: "Iniciar simulação" }).click();
  await expect(page).toHaveURL(/preparacao/);
  const id = page.url().split("/").at(-1)!;
  const original = await (await page.request.get(`/api/simulations/${id}`)).json();
  await page.getByRole("button", { name: "Contexto de mercado", exact: true }).click();
  await expect(page.getByText("Dólar simulado", { exact: true })).toBeVisible();
  await expect(page.getByText(/Alumínio: SIMULADO/)).toBeVisible();
  await page.getByRole("button", { name: "Fornecedores", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Comparar fornecedores" })).toBeVisible();
  await page.goto(`/negociacao/${id}`);
  const input = page.getByLabel(/^Sua mensagem para/);
  await input.fill("Como podemos alinhar a capacidade e os custos com nosso forecast?");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(input).toBeEnabled();
  await page.getByRole("button", { name: "Avaliar outro fornecedor" }).click();
  await page.getByRole("radio", { name: /Circular Chapas Industriais/ }).focus();
  await page.keyboard.press("Space");
  await page
    .getByLabel("Justificativa estratégica")
    .fill(
      "Comparo a homologação e a capacidade da alternativa nacional para reduzir o risco cambial.",
    );
  await page.getByRole("button", { name: "Confirmar mudança" }).click();
  await expect(page.getByText("Troca realizada", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Troca realizada", { exact: true })).toBeVisible();
  await input.fill(
    "Em troca de contrato de 18 meses, volume mínimo e forecast, proponho pagamento em 30 dias com dados de qualidade.",
  );
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(input).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto(`/proposta/${id}`);
  await page.getByRole("button", { name: "Revisar proposta" }).click();
  await page.getByRole("button", { name: "Confirmar proposta" }).click();
  await expect(page).toHaveURL(/diagnostico/);
  await expect(page.getByRole("heading", { name: "Decisão de fornecimento" })).toBeVisible();
  await page.getByRole("button", { name: "Mesma seed", exact: true }).click();
  await expect(page).toHaveURL(/preparacao/);
  const replayId = page.url().split("/").at(-1)!;
  const replay = await (await page.request.get(`/api/simulations/${replayId}`)).json();
  expect(replayId).not.toBe(id);
  expect(replay.aluminum.instance).toEqual(original.aluminum.instance);
  expect(replay.aluminum.suppliers).toEqual(original.aluminum.suppliers);
  await page.goto(`/diagnostico/${id}`);
  await expect(page.getByText("Circular Chapas Industriais", { exact: true })).toBeVisible();
  await page.goto("/historico");
  await expect(page.getByRole("link", { name: /Ver relatório/ }).first()).toBeVisible();
  await page.getByRole("combobox", { name: /Material/ }).click();
  await page.getByRole("option", { name: "7075-T6", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nenhuma tentativa encontrada" })).toBeVisible();
  await page.getByRole("combobox", { name: /Material/ }).click();
  await page.getByRole("option", { name: "6061-T6", exact: true }).click();
  await expect(page.getByRole("link", { name: /Ver relatório/ }).first()).toBeVisible();
  await page
    .getByRole("link", { name: /Ver relatório/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Decisão de fornecimento" })).toBeVisible();
});
