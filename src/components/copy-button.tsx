"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "./toaster";

// Copies text and confirms with a check mark and a toast.
export function CopyButton({ text, label = "Copy link", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast("Copied to clipboard.");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast("Couldn't copy. Select the link and copy it by hand.", "error");
        }
      }}
      className={["inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium shadow-xs transition-colors hover:bg-surface-2", className].filter(Boolean).join(" ")}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
