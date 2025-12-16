import React from "react";
import { Link } from "wouter";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <Logo size="md" />
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/"><span className="text-foreground/80 hover:text-foreground cursor-pointer font-medium">Início</span></Link>
            <Link href="/login"><span className="text-foreground/80 hover:text-foreground cursor-pointer font-medium">Entrar</span></Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button>Acessar Sistema</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Logo size="sm" />
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Degusta Pizzas. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
