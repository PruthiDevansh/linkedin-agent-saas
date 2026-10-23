import { Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit";
import { Badge, Card, CardHeader, Flash, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { requireAdmin } from "@/lib/session";
import { db } from "@/lib/supabase";
import { addLibraryItem, deleteLibraryItem } from "../actions";

export const metadata = { title: "Library" };

export default async function AdminLibrary({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  await requireAdmin();
  const { data } = await db().from("inspiration_items").select("*").neq("kind", "trending").order("created_at", { ascending: false }).limit(200);

  return (
    <>
      <PageHeader title="Inspiration library" description="Curated examples, hooks and templates every user sees under Inspiration → Curated." />
      <Flash searchParams={params} />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader title="Add item" />
          <form action={addLibraryItem} className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="kind">Type</Label>
                <Select id="kind" name="kind" defaultValue="curated"><option value="curated">Example post</option><option value="hook">Hook</option><option value="template">Template</option></Select>
              </div>
              <div><Label htmlFor="category">Category</Label><Input id="category" name="category" placeholder="Career" /></div>
            </div>
            <div><Label htmlFor="title">Title</Label><Input id="title" name="title" required /></div>
            <div><Label htmlFor="body">Content</Label><Textarea id="body" name="body" placeholder="The post or pattern. Only add content you have the right to share." /></div>
            <div><Label htmlFor="source_url" hint="(optional)">Source link</Label><Input id="source_url" name="source_url" type="url" /></div>
            <SubmitButton pending="Adding…">Add to library</SubmitButton>
          </form>
        </Card>
        <Card>
          <CardHeader title={`${data?.length ?? 0} items`} />
          <ul className="divide-y divide-border">
            {(data ?? []).map((item) => (
              <li key={item.id} className="flex gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{item.kind}</Badge><span className="text-xs text-muted">{item.category}</span></div>
                  <div className="mt-1 font-medium">{item.title}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{item.body}</p>
                </div>
                <form action={deleteLibraryItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="rounded-md p-2 text-muted hover:text-danger" aria-label="Delete"><Trash2 className="size-4" /></button>
                </form>
              </li>
            ))}
            {!data?.length && <li className="px-5 py-8 text-center text-sm text-muted">Nothing yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
