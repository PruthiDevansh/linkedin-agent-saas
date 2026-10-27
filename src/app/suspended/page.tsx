import { Logo } from "@/components/brand";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { Card, PlainButton } from "@/components/ui";
import { signOut } from "../(auth)/actions";

export const metadata = { title: "Account paused" };

export default async function SuspendedPage() {
  return (
    <>
    <ImpersonationBanner />
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-xl font-semibold">Your account is paused</h1>
        <p className="mt-2 text-sm text-muted">Please contact support to restore access.</p>
        <form action={signOut} className="mt-6"><PlainButton className="text-sm text-brand hover:underline">Log out</PlainButton></form>
      </Card>
    </div>
    </>
  );
}
