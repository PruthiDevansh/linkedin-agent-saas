import { Images, Lightbulb, Newspaper } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { SubmitButton } from "@/components/submit";
import { Card, cx, Flash, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { CATEGORIES, CATEGORY_IDS, categoryForToday } from "@/lib/engine/topics";
import { currentWorkspace, requireActiveUser } from "@/lib/session";
import { generateCarousel, generateIdea, generateNews } from "../actions";

export const metadata = { title: "Create" };

const TABS = [
  { id: "news", label: "From trending news", icon: Newspaper, blurb: "The agent finds today's most talked-about story in your topic and writes about it." },
  { id: "idea", label: "From your idea", icon: Lightbulb, blurb: "Write a line or two. Add a photo if you like. The AI turns it into an engaging post." },
  { id: "carousel", label: "Carousel", icon: Images, blurb: "A 6–8 slide swipeable PDF post. Carousels often get the most reach on LinkedIn." },
] as const;

function ChatToggle({ linked }: { linked: boolean }) {
  if (!linked) return null;
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <input type="checkbox" name="chat" className="size-4 accent-[var(--brand)]" /> Also send to my Telegram/WhatsApp
    </label>
  );
}

export default async function CreatePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const profile = await requireActiveUser();
  const { workspace } = await currentWorkspace(profile, (await cookies()).get("ws")?.value);
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "news";
  const linked = !!(profile.telegram_chat_id || profile.whatsapp_number);
  const today = categoryForToday(workspace.topics, workspace.timezone);

  return (
    <>
      <PageHeader title="Create a post" description="Every draft waits for your approval. Nothing posts automatically unless you schedule it." />
      <Flash searchParams={params} />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {TABS.map(({ id, label, icon: Icon, blurb }) => (
          <Link
            key={id}
            href={`/app/create?tab=${id}`}
            className={cx("rounded-2xl border p-4 transition-colors", tab === id ? "border-brand bg-brand-soft" : "border-border bg-surface hover:bg-surface-2")}
          >
            <Icon className={cx("size-5", tab === id ? "text-brand" : "text-muted")} />
            <div className="mt-2 font-medium">{label}</div>
            <p className="mt-1 text-xs text-muted">{blurb}</p>
          </Link>
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        {tab === "news" && (
          <form action={generateNews} className="space-y-5">
            <div>
              <Label htmlFor="category">Topic</Label>
              <Select id="category" name="category" defaultValue={today}>
                {CATEGORY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CATEGORIES[id].label}
                    {workspace.topics.includes(id) ? " ★" : ""}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-muted">★ = your topics. Sources: tech blogs, TechCrunch, Inc42 and more, plus Hacker News upvotes and Google Trends India.</p>
            </div>
            <ChatToggle linked={linked} />
            <SubmitButton pending="Reading the news & writing… (≈20s)">Find news & write post</SubmitButton>
          </form>
        )}

        {tab === "idea" && (
          <form action={generateIdea} className="space-y-5">
            <div>
              <Label htmlFor="idea">Your idea</Label>
              <Textarea id="idea" name="idea" required minLength={10} maxLength={1500} defaultValue={params.idea} autoFocus={!!params.idea} placeholder="e.g. I built an AI agent in 2 days with free tools that drafts my LinkedIn posts; I only approve on Telegram." />
            </div>
            <div>
              <Label htmlFor="photo" hint="(optional)">Photo</Label>
              <Input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" className="file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm" />
            </div>
            <ChatToggle linked={linked} />
            <SubmitButton pending="Writing your post…">Write my post</SubmitButton>
          </form>
        )}

        {tab === "carousel" && (
          <form action={generateCarousel} className="space-y-5">
            <div>
              <Label htmlFor="subject">What should the carousel teach?</Label>
              <Textarea id="subject" name="subject" required minLength={10} maxLength={1500} placeholder="e.g. 5 mistakes junior developers make in code reviews, and how to fix each one" />
            </div>
            <ChatToggle linked={linked} />
            <SubmitButton pending="Designing slides… (≈25s)">Build carousel</SubmitButton>
          </form>
        )}
      </Card>
    </>
  );
}
