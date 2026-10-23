import { Plus, Trash2, UserPlus } from "lucide-react";
import { cookies } from "next/headers";
import { SubmitButton } from "@/components/submit";
import { Badge, ButtonLink, Card, CardHeader, Flash, Input, Notice, PageHeader, Select } from "@/components/ui";
import { env } from "@/lib/env";
import { currentWorkspace, requireActiveUser } from "@/lib/session";
import { getSettings, maxAccounts } from "@/lib/settings";
import { db } from "@/lib/supabase";
import { formatInZone } from "@/lib/time";
import { createWorkspace, disconnectLinkedIn, inviteMember, removeMember, revokeInvite } from "../actions";

export const metadata = { title: "Accounts & team" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const profile = await requireActiveUser();
  const { workspace, role } = await currentWorkspace(profile, (await cookies()).get("ws")?.value);
  const settings = await getSettings();
  const limit = maxAccounts(settings, profile);

  const [{ data: accounts }, { data: members }, { data: invites }] = await Promise.all([
    db().from("linkedin_accounts").select("id, name, expires_at, created_at").eq("workspace_id", workspace.id).order("created_at"),
    db().from("workspace_members").select("role, user_id, profiles(full_name, email)").eq("workspace_id", workspace.id),
    db().from("workspace_invites").select("*").eq("workspace_id", workspace.id).is("accepted_at", null).order("created_at", { ascending: false }),
  ]);
  const atLimit = (accounts?.length ?? 0) >= limit;
  const isOwner = role === "owner";

  return (
    <>
      <PageHeader title="Accounts & team" description="LinkedIn profiles this workspace posts to, and the people who can help." />
      <Flash searchParams={params} />

      <Card>
        <CardHeader
          title="LinkedIn accounts"
          description={`${accounts?.length ?? 0} of ${limit} on your plan. Each person connects their own profile.`}
          action={
            !atLimit && role !== "viewer" ? (
              <ButtonLink href={`/api/linkedin/auth?ws=${workspace.id}`} prefetch={false}><Plus className="size-4" /> Connect LinkedIn</ButtonLink>
            ) : undefined
          }
        />
        {atLimit && <div className="px-5 pt-4"><Notice tone="warning">You've reached your plan's account limit. Upgrade to Pro to add more.</Notice></div>}
        <ul className="divide-y divide-border">
          {(accounts ?? []).map((a) => {
            const days = Math.floor((new Date(a.expires_at).getTime() - Date.now()) / 86_400_000);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="grid size-10 place-items-center rounded-full bg-[#0a66c2] text-sm font-bold text-white">in</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.name || "LinkedIn member"}</div>
                  <div className="text-xs text-muted">Connected {formatInZone(a.created_at, workspace.timezone, { dateStyle: "medium" })}</div>
                </div>
                {days <= 0 ? <Badge tone="danger">Expired</Badge> : days <= 7 ? <Badge tone="warning">{days} days left</Badge> : <Badge tone="success">Active · {days} days</Badge>}
                {days <= 7 && role !== "viewer" && <ButtonLink variant="secondary" href={`/api/linkedin/auth?ws=${workspace.id}`} prefetch={false}>Reconnect</ButtonLink>}
                {role !== "viewer" && (
                  <form action={disconnectLinkedIn}>
                    <input type="hidden" name="accountId" value={a.id} />
                    <button className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-danger" aria-label="Remove account"><Trash2 className="size-4" /></button>
                  </form>
                )}
              </li>
            );
          })}
          {!accounts?.length && <li className="px-5 py-6 text-sm text-muted">No LinkedIn account yet. Connect one to start posting.</li>}
        </ul>
        <p className="border-t border-border px-5 py-3 text-xs text-muted">LinkedIn logins last 60 days. We'll remind you on Telegram/WhatsApp a week before.</p>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Team" description="Editors can create and publish. Viewers can only look." />
          <ul className="divide-y divide-border">
            {(members ?? []).map((m) => {
              const p = m.profiles as unknown as { full_name: string; email: string };
              return (
                <li key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.full_name || p.email}</div>
                    <div className="truncate text-xs text-muted">{p.email}</div>
                  </div>
                  <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{m.role}</Badge>
                  {isOwner && m.user_id !== profile.id && (
                    <form action={removeMember}>
                      <input type="hidden" name="userId" value={m.user_id} />
                      <button className="rounded-md p-1.5 text-muted hover:text-danger" aria-label="Remove member"><Trash2 className="size-4" /></button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          {isOwner && (
            <div className="border-t border-border p-5">
              {params.invite && (
                <div className="mb-4">
                  <Notice tone="success">
                    Invite link (send it to them):
                    <code className="mt-1 block break-all rounded bg-surface px-2 py-1 text-xs text-text">{`${env.appUrl()}/invite/${params.invite}`}</code>
                  </Notice>
                </div>
              )}
              <form action={inviteMember} className="flex flex-wrap gap-2">
                <Input name="email" type="email" placeholder="teammate@company.com" required className="min-w-48 flex-1" />
                <Select name="role" defaultValue="editor" className="w-28">
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <SubmitButton pending="…"><UserPlus className="size-4" /> Invite</SubmitButton>
              </form>
              {!!invites?.length && (
                <ul className="mt-4 space-y-2 text-sm">
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                      <span className="truncate">{i.email} · {i.role} · pending</span>
                      <form action={revokeInvite}><input type="hidden" name="inviteId" value={i.id} /><button className="text-xs text-muted hover:text-danger">Revoke</button></form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Workspaces" description="Agencies: one workspace per client, each with its own voice, topics, accounts and team." />
          <form action={createWorkspace} className="flex gap-2 p-5">
            <Input name="name" placeholder="Client name, e.g. Acme Corp" required />
            <SubmitButton variant="secondary" pending="…"><Plus className="size-4" /> Create</SubmitButton>
          </form>
          <p className="px-5 pb-5 text-xs text-muted">Switch workspaces from the top of the sidebar.</p>
        </Card>
      </div>
    </>
  );
}
