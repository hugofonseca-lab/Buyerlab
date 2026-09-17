import { Link, useRouterState } from "@tanstack/react-router";
import { FlaskConical, Menu, X } from "lucide-react";
import { useState } from "react";
import { AVISO_EDUCACIONAL } from "@/domain/scenario";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/" as const, label: "Início" },
  { to: "/configurar" as const, label: "Treinar" },
  { to: "/instrutor" as const, label: "Instrutor" },
  { to: "/historico" as const, label: "Histórico" },
  { to: "/impacto" as const, label: "Impacto" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5" aria-label="BuyerLab — página inicial">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FlaskConical aria-hidden="true" className="size-5" />
          </span>
          <span className="font-display text-xl font-bold text-primary">
            Buyer<span className="text-accent">Lab</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {nav.map((item) => (
            <Button key={item.to} asChild variant={pathname === item.to ? "secondary" : "ghost"}>
              <Link to={item.to}>{item.label}</Link>
            </Button>
          ))}
        </nav>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav className="border-t bg-background px-4 py-3 md:hidden" aria-label="Navegação móvel">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                "block rounded-md px-3 py-3 text-sm font-medium",
                pathname === item.to
                  ? "bg-secondary text-secondary-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print border-t bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_2fr] lg:px-8">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <FlaskConical className="size-5" aria-hidden="true" /> BuyerLab
        </div>
        <p className="text-sm leading-6 text-primary-foreground/75">{AVISO_EDUCACIONAL}</p>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
