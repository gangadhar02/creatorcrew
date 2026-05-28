<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI components: prefer the shadcn MCP for discovery

This project ships a shadcn-based design system. A shadcn MCP server is registered in `.mcp.json` and exposes the official shadcn registry conversationally. **When you need to add or evaluate a UI component, use the MCP first** — do NOT guess component names from training data.

Workflow:
1. **Discover**: ask the `shadcn` MCP what's available (e.g. "list components in the @shadcn registry", "show me data-table examples"). Use that to pick the right primitive rather than inventing one.
2. **Add**: install via `npx shadcn@latest add <component>` (the MCP can do this for you too). New primitives land in `components/ui/`.
3. **Compose**: import from `@/components/ui/<component>` and combine with `cn()` from `@/lib/utils`. Use `lucide-react` for icons (not inline SVGs), `framer-motion` for animations, and `sonner`'s `toast()` for notifications (no `alert()`).

If a request needs UI work and you don't see a shadcn MCP tool available, stop and ask the user to start a fresh Claude Code session — the MCP loads at session start.

## Token conventions

- Use Tailwind shadcn classes: `bg-primary`, `text-muted-foreground`, `border-border`, `bg-card`, `bg-accent` (subtle hover), `text-destructive`.
- Avoid raw `var(--accent)` / `var(--muted)` — those were the legacy naming and have been migrated.
- Dark mode toggles via the `.dark` class on `<html>` (set pre-hydration in `app/layout.tsx`).

## Animation conventions

- Page-entry: add `animate-page-in` to the outermost container (already on `app/layout.tsx`'s main).
- Cards that should respond to hover: add `card-hover` class (1px lift + soft shadow).
- Motion-driven list entries: use `framer-motion` with `initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}` and small stagger via `transition={{ delay: i * 0.03 }}`.

## What NOT to do

- Don't reach for Radix UI directly — this project's shadcn variant is built on `@base-ui/react` (set as `style: "base-nova"` in `components.json`). Base UI APIs differ: `Tooltip.Provider` uses `delay`, triggers use `render` prop instead of `asChild`.
- Don't add a new color palette. Modify CSS vars in `app/globals.css` to rebrand instead.
- Don't use inline SVG when there's a lucide equivalent.
