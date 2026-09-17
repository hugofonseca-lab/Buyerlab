import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, BrainCircuit, Repeat2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/buyerlab/site-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BuyerLab — Treinamento de negociação" },
      {
        name: "description",
        content:
          "Pratique negociação corporativa com um fornecedor simulado e receba diagnóstico objetivo por evidências.",
      },
      { property: "og:title", content: "BuyerLab — Treine antes de chegar à mesa" },
      {
        property: "og:description",
        content:
          "Simulação profunda de negociação corporativa com feedback baseado nas suas decisões.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <PageShell>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 hidden w-2/5 border-l border-primary-foreground/10 lg:block"
        >
          <div className="grid h-full grid-cols-4 opacity-20">
            {Array.from({ length: 16 }).map((_, index) => (
              <span key={index} className="border-b border-r border-primary-foreground/25" />
            ))}
          </div>
        </div>
        <div className="relative mx-auto grid min-h-[70vh] max-w-7xl content-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_.8fr] lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent">
              <BrainCircuit className="size-4" /> Simulação corporativa inteligente
            </p>
            <h1 className="text-4xl font-bold leading-tight sm:text-6xl lg:text-7xl">BuyerLab</h1>
            <p className="mt-4 font-display text-2xl font-medium text-primary-foreground/90 sm:text-3xl">
              Treine a negociação antes de chegar à mesa.
            </p>
            <p className="mt-6 max-w-2xl text-base leading-7 text-primary-foreground/70 sm:text-lg">
              Negocie a compra de chapas de alumínio com fornecedores industriais simulados. Compare
              custo total, prazo, qualidade e risco antes de decidir.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Link to="/configurar">
                  Iniciar treinamento <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/25 bg-primary text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/instrutor">Configurar como instrutor</Link>
              </Button>
            </div>
          </div>
          <div className="self-end lg:self-center">
            <div className="border-l-2 border-accent pl-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                Cenário em destaque
              </p>
              <p className="mt-3 font-display text-2xl font-semibold">
                Chapas de alumínio industrial
              </p>
              <p className="mt-2 text-sm leading-6 text-primary-foreground/70">
                Cada seed combina uma liga, volume, estoque, mercado congelado e dois ou três
                fornecedores coerentes.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-primary-foreground/15 pt-5">
                <div>
                  <dt className="text-xs text-primary-foreground/55">Materiais</dt>
                  <dd className="mt-1 font-display text-xl font-bold">5052 · 6061 · 7075</dd>
                </div>
                <div>
                  <dt className="text-xs text-primary-foreground/55">Fornecedores</dt>
                  <dd className="mt-1 font-display text-xl font-bold">2 ou 3 por execução</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>
      <section className="border-b bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
            <Feature
              icon={<BrainCircuit />}
              title="Cenário profundo"
              text="Um caso empresarial com interesses, riscos e responsabilidades dos dois lados."
            />
            <Feature
              icon={<Repeat2 />}
              title="Simulação realista"
              text="Perfis, estados emocionais, concessões e eventos que respondem às suas escolhas."
            />
            <Feature
              icon={<BarChart3 />}
              title="Feedback que ensina"
              text="Nota, evidências por turno e uma recomendação prática para a próxima tentativa."
            />
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-5 border-t pt-8 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-xl font-semibold">
                Preparado para testar sua estratégia?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Sem cadastro. Uma simulação completa leva poucos minutos.
              </p>
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/configurar">
                  Começar agora <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/impacto">
                  <ShieldCheck /> Ver impacto
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <article className="bg-card p-7">
      <span className="mb-5 flex size-10 items-center justify-center rounded-md bg-accent/10 text-accent">
        {icon}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </article>
  );
}
