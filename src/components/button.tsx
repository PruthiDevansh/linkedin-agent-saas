"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { BASE, VARIANTS, type Variant } from "./button-styles";

type Props = ComponentProps<"button"> & {
  /** Text shown next to the spinner while the form's server action runs. */
  pending?: ReactNode;
  /** Ask before submitting (for destructive actions). */
  confirm?: string;
};

// Tracks whether *this* button submitted the form, so only it shows the spinner
// while every button in the form is locked against double submits.
function usePendingClick({ type, disabled, onClick, confirm: confirmText }: Props) {
  const status = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const isSubmit = (type ?? "submit") === "submit";

  useEffect(() => {
    if (!status.pending) setClicked(false);
  }, [status.pending]);

  return {
    busy: isSubmit && status.pending && clicked,
    disabled: disabled || (isSubmit && status.pending),
    onClick(e: MouseEvent<HTMLButtonElement>) {
      if (confirmText && !window.confirm(confirmText)) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
      // Browsers also fire this click when Enter submits the form.
      if (!e.defaultPrevented && isSubmit) setClicked(true);
    },
  };
}

// Every submit button shows a spinner while the server works, so a click never feels ignored.
export function Button({ variant = "primary", className, pending, confirm, children, onClick, disabled, ...props }: Props & { variant?: Variant }) {
  const p = usePendingClick({ type: props.type, disabled, onClick, confirm });
  return (
    <button {...props} className={[BASE, VARIANTS[variant], className].filter(Boolean).join(" ")} disabled={p.disabled} aria-busy={p.busy || undefined} onClick={p.onClick}>
      {p.busy ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {pending ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

// Unstyled version for icon and text-link buttons inside forms: swaps its content for a spinner.
export function PlainButton({ className, pending, confirm, children, onClick, disabled, ...props }: Props) {
  const p = usePendingClick({ type: props.type, disabled, onClick, confirm });
  return (
    <button {...props} className={[className, "disabled:opacity-60"].filter(Boolean).join(" ")} disabled={p.disabled} aria-busy={p.busy || undefined} onClick={p.onClick}>
      {p.busy ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="size-3.5 animate-spin" />
          {pending}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
