import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Link2, SlidersHorizontal } from "lucide-react";
import { ConfigForm } from "@/components/buyerlab/config-form";
import { PageHeader } from "@/components/buyerlab/page-header";
import { PageShell } from "@/components/buyerlab/site-shell";

export const Route = createFileRoute("/instrutor")({
  head: () => ({
    meta: [
      { title: "Configuração do instrutor — BuyerLab" },
      {
        name: "description",
        content:
          "Configure condições comparáveis e compartilhe uma simulação BuyerLab com participantes.",
      },
      { property: "og:title", content: "Configuração do instrutor — BuyerLab" },
      {
        property: "og:description",
        content: "Crie e compartilhe uma negociação simulada com seed controlada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstructorPage,
});

function InstructorPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Área do instrutor"
        title="Condições comparáveis, sem painel complexo"
        description="Fixe perfil, dificuldade e seed para que participantes enfrentem a mesma situação. O link abre a configuração pronta."
      />
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Item
            icon={<SlidersHorizontal />}
            title="Controle as condições"
            text="Defina urgência, perfil e nível sem alterar o cenário-base."
          />
          <Item
            icon={<Link2 />}
            title="Compartilhe por link"
            text="A configuração viaja na URL e não exige cadastro."
          />
          <Item
            icon={<ClipboardCheck />}
            title="Compare o desempenho"
            text="Use a mesma seed e consulte o relatório compartilhável."
          />
        </div>
        <ConfigForm instructor defaults={{ modo: "avaliacao" }} />
      </section>
    </PageShell>
  );
}
function Item({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-4 border-l-2 border-accent bg-card p-5">
      <span className="text-accent">{icon}</span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
