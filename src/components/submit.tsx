"use client";

import type { ComponentProps } from "react";
import { Button } from "./button";

// A submit button that shows a spinner while the server action runs.
// (Every <Button> does this now; kept so existing imports keep working.)
export function SubmitButton({ pending, ...props }: ComponentProps<typeof Button>) {
  return <Button type="submit" pending={pending ?? "Working…"} {...props} />;
}
