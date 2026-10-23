import Link from "next/link";
import { Button, Flash, Input, Label } from "@/components/ui";
import { signUp } from "../actions";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Your first AI draft is about 2 minutes away.</p>
      <div className="mt-6">
        <Flash searchParams={params} />
        <form action={signUp} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" autoComplete="name" required defaultValue={params.full_name} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={params.email} />
          </div>
          <div>
            <Label htmlFor="password" hint="(8+ characters)">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <Button type="submit" className="w-full">Create account</Button>
        </form>
        <p className="mt-4 text-xs text-muted">By signing up you agree to our terms and privacy policy.</p>
        <p className="mt-8 text-sm text-muted">
          Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Log in</Link>
        </p>
      </div>
    </>
  );
}
