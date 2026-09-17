import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Factory, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/buyerlab/page-header";
import { PageShell } from "@/components/buyerlab/site-shell";

export const Route = createFileRoute("/impacto")({
  head: () => ({
    meta: [
      { title: "Impacto e aplicabilidade — BuyerLab" },
      {
        name: "description",
        content:
          "Como o BuyerLab amplia o acesso à aprendizagem prática de negociação em procurement.",
      },
      { property: "og:title", content: "Impacto e aplicabilidade — BuyerLab" },
      {
        property: "og:description",
        content:
          "Formação aplicada, inovação digital e acesso democrático a treinamento de negociação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImpactPage,
});

function ImpactPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Impacto"
        title="Aprendizagem aplicada, acessível e comparável"
        description="Uma forma segura de praticar decisões de alto impacto antes de levá-las a uma negociação real."
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
          <Goal
            icon={<BookOpen />}
            code="ODS 4"
            title="Educação de qualidade"
            text="Formação prática, feedback objetivo e aprendizagem por repetição em um ambiente seguro."
          />
          <Goal
            icon={<Factory />}
            code="ODS 9"
            title="Inovação e infraestrutura"
            text="Infraestrutura digital replicável para elevar a maturidade de procurement e supply chain."
          />
          <Goal
            icon={<Scale />}
            code="ODS 10"
            title="Redução das desigualdades"
            text="Democratiza o acesso a treinamento avançado sem depender de laboratórios caros ou atores especializados."
          />
        </div>
        <div className="mt-14 grid gap-10 border-t pt-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Onde aplicar</h2>
            <ul className="mt-5 grid gap-3 text-sm text-muted-foreground">
              <li className="border-l-2 border-accent pl-4">Integração de novos compradores.</li>
              <li className="border-l-2 border-accent pl-4">
                Capacitação contínua de procurement e supply chain.
              </li>
              <li className="border-l-2 border-accent pl-4">
                Assessment comparável por cenário e seed.
              </li>
              <li className="border-l-2 border-accent pl-4">
                Preparação antes de negociações críticas.
              </li>
            </ul>
          </div>
          <div className="bg-primary p-7 text-primary-foreground">
            <h2 className="text-2xl font-bold">Profundidade acima de quantidade</h2>
            <p className="mt-4 text-sm leading-6 text-primary-foreground/70">
              O MVP concentra o esforço em um cenário profundo, com variações de comportamento,
              poder, urgência, eventos e concessões. Assim, cada repetição testa uma competência
              real — não apenas uma resposta decorada.
            </p>
            <Button asChild className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/configurar">
                Experimentar o BuyerLab <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
function Goal({
  icon,
  code,
  title,
  text,
}: {
  icon: React.ReactNode;
  code: string;
  title: string;
  text: string;
}) {
  return (
    <article className="bg-card p-7">
      <div className="flex items-center justify-between">
        <span className="text-accent">{icon}</span>
        <span className="font-mono text-xs font-semibold text-muted-foreground">{code}</span>
      </div>
      <h2 className="mt-6 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </article>
  );
}
