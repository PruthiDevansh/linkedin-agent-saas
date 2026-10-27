import Link from "next/link";
import { Button, Flash, Input, Label } from "@/components/ui";
import { resetPassword, signIn } from "../actions";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Log in to your dashboard.</p>
      <div className="mt-6">
        <Flash searchParams={params} />
        <form action={signIn} className="space-y-4">
          <input type="hidden" name="next" value={params.next ?? "/app"} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={params.email} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <Button type="submit" className="w-full" pending="Logging you in…">Log in</Button>
        </form>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted hover:text-text">Forgot password?</summary>
          <form action={resetPassword} className="mt-3 flex gap-2">
            <Input name="email" type="email" placeholder="you@example.com" required />
            <Button type="submit" variant="secondary" pending="Sending…">Send link</Button>
          </form>
        </details>
        <p className="mt-8 text-sm text-muted">
          New here? <Link href="/register" className="font-medium text-brand hover:underline">Create an account</Link>
        </p>
      </div>
    </>
  );
}
