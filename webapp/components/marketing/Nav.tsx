"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden sm:inline-flex items-center rounded-full px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Sign up
          </Link>
        </div>
      </div>
    </nav>
  );
}