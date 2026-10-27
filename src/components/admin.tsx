import type { ReactNode } from "react";
import { updateUser } from "@/app/admin/actions";
import { PlainButton } from "./button";
import { cx } from "./ui";

// The on/off switch drawn inside admin toggle buttons.
export function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span className={cx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", on ? "bg-brand" : "bg-border-strong")}>
      <span className={cx("inline-block size-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </span>
  );
}

// One-click on/off switch for a user setting (Pro, built-in AI, …). Shows a spinner while saving.
export function UserToggle({ userId, on, onAction, offAction, label, back, confirm }: {
  userId: string;
  on: boolean;
  onAction: string;
  offAction: string;
  label: ReactNode;
  back?: string;
  confirm?: string;
}) {
  return (
    <form action={updateUser}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="action" value={on ? offAction : onAction} />
      {back && <input type="hidden" name="back" value={back} />}
      <PlainButton
        type="submit"
        role="switch"
        aria-checked={on}
        pending={<span className="text-xs text-muted">Saving…</span>}
        confirm={confirm}
        className="inline-flex items-center gap-2 rounded-md text-sm"
        title={on ? "Click to switch off" : "Click to switch on"}
      >
        <SwitchTrack on={on} />
        {label}
      </PlainButton>
    </form>
  );
}
