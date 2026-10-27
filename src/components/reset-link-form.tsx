"use client";

import { useActionState } from "react";
import { generateResetLink, type LinkState } from "@/app/admin/actions";
import { Button } from "./button";
import { CopyButton } from "./copy-button";

// Makes a password-reset link the admin can send by hand (no email, so no email limits).
export function ResetLinkForm({ userId }: { userId: string }) {
  const [state, action] = useActionState<LinkState, FormData>(generateResetLink, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="secondary" className="w-full" pending="Creating link…">
        Create password-reset link
      </Button>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      {state.link && (
        <div className="space-y-1.5 rounded-lg bg-surface-2 p-2.5">
          <p className="break-all font-mono text-[11px] leading-snug text-muted">{state.link}</p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted">Works once, expires in about an hour.</span>
            <CopyButton text={state.link} />
          </div>
        </div>
      )}
    </form>
  );
}
