import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ConfigForm } from "@/components/buyerlab/config-form";
import { PageHeader } from "@/components/buyerlab/page-header";
import { PageShell } from "@/components/buyerlab/site-shell";

const searchSchema = z.object({
  cenario: z.enum(["aluminum", "legacy"]).optional(),
  material: z.enum(["5052-H32", "6061-T6", "7075-T6"]).optional(),
  modo: z.enum(["treinamento", "avaliacao"]).optional(),
  dif: z.enum(["iniciante", "intermediario", "avancado"]).optional(),
  perfil: z.enum(["aleatorio", "colaborativo", "analitico", "dominante", "defensivo"]).optional(),
  urgencia: z.enum(["baixa", "media", "alta"]).optional(),
  seed: z.string().max(24).optional(),
});

export const Route = createFileRoute("/configurar")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Configurar simulação — BuyerLab" },
      {
        name: "description",
        content:
          "Escolha modo, dificuldade e seed para iniciar sua negociação simulada no BuyerLab.",
      },
      { property: "og:title", content: "Configurar simulação — BuyerLab" },
      {
        property: "og:description",
        content: "Prepare uma simulação reproduzível de negociação corporativa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const search = Route.useSearch();
  return (
    <PageShell>
      <PageHeader
        eyebrow="Nova execução"
        title="Configure sua simulação"
        description="Escolha as condições ou mantenha os padrões. A seed permite repetir exatamente a mesma variação depois."
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <ConfigForm
          defaults={{
            scenarioType: search.cenario ?? (search.seed ? "legacy" : "aluminum"),
            ...(search.material ? { materialId: search.material } : {}),
            ...(search.modo ? { modo: search.modo } : {}),
            ...(search.dif ? { dificuldade: search.dif } : {}),
            ...(search.perfil ? { perfil: search.perfil } : {}),
            ...(search.urgencia ? { urgencia: search.urgencia } : {}),
            ...(search.seed ? { seed: search.seed } : {}),
          }}
        />
      </div>
    </PageShell>
  );
}
