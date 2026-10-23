"use client";

import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./ui";

// A submit button that shows a spinner while the server action runs.
export function SubmitButton({ children, pending, ...props }: ComponentProps<typeof Button> & { pending?: ReactNode }) {
  const status = useFormStatus();
  return (
    <Button type="submit" disabled={status.pending} {...props}>
      {status.pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> {pending ?? "Working…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
