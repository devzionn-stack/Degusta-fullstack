import React from "react";
import { Link } from "wouter";
import { Pizza, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pizza className="h-8 w-8 text-primary" />
            <Link href="/">
              <span className="text-2xl font-serif font-bold cursor-pointer">Bella Napoli</span>
            </Link>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/"><span className="text-foreground/80 hover:text-foreground cursor-pointer font-medium">Home</span></Link>
            <Link href="/menu"><span className="text-foreground/80 hover:text-foreground cursor-pointer font-medium">Menu</span></Link>
            <Link href="/about"><span className="text-foreground/80 hover:text-foreground cursor-pointer font-medium">Our Story</span></Link>
            <Link href="/contact"><span className="text-foreground/80 hover:text-foreground cursor-pointer font-medium">Contact</span></Link>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                2
              </span>
            </Button>
            <Button>Order Now</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Pizza className="h-6 w-6 text-primary" />
                <span className="text-xl font-serif font-bold">Bella Napoli</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Authentic Neapolitan pizza made with love and tradition since 1985.
              </p>
            </div>
            
            <div>
              <h3 className="font-serif font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Menu</a></li>
                <li><a href="#" className="hover:text-foreground">Locations</a></li>
                <li><a href="#" className="hover:text-foreground">About Us</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-serif font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>123 Pizza Street</li>
                <li>Napoli, NY 10012</li>
                <li>(555) 123-4567</li>
                <li>ciao@bellanapoli.com</li>
              </ul>
            </div>

            <div>
              <h3 className="font-serif font-semibold mb-4">Hours</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex justify-between"><span>Mon-Thu</span> <span>11am - 10pm</span></li>
                <li className="flex justify-between"><span>Fri-Sat</span> <span>11am - 11pm</span></li>
                <li className="flex justify-between"><span>Sun</span> <span>12pm - 9:30pm</span></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © 2025 Bella Napoli Pizzeria. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
