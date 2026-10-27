// Shared by the client <Button> and the server-rendered <ButtonLink>.
export type Variant = "primary" | "secondary" | "ghost" | "danger";

export const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm shadow-brand/20 hover:bg-brand-strong active:translate-y-px",
  secondary: "bg-surface text-text border border-border shadow-xs hover:bg-surface-2 hover:border-border-strong active:translate-y-px",
  ghost: "text-muted hover:text-text hover:bg-surface-2",
  danger: "bg-danger text-white shadow-sm hover:opacity-90 active:translate-y-px",
};

export const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap select-none";
