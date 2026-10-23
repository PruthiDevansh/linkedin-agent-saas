import Link from "next/link";

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Kalam";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16l-1 4z" />
          <path d="M14 6l3 3" />
        </svg>
      </span>
      <span className="text-lg">{APP_NAME}</span>
    </Link>
  );
}
