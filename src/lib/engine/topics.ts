// Topics users can pick for their daily drafts. Each has news feeds and
// Hacker News searches (HN points are our "is this going viral?" signal).

export type CategoryId =
  | "ai-models"
  | "ai-usecases"
  | "dotnet"
  | "webdev"
  | "cloud-devops"
  | "security"
  | "fintech"
  | "startups"
  | "product"
  | "marketing"
  | "career"
  | "tech-news";

export type Category = {
  label: string;
  angle: string;
  feeds: string[];
  hnQueries: string[];
};

export const CATEGORIES: Record<CategoryId, Category> = {
  "ai-models": {
    label: "New AI models: best or not?",
    angle: "Say what is new, who it is good for, and give an honest verdict: really better, or hype? Compare with tools people already use.",
    feeds: ["https://simonwillison.net/atom/everything/", "https://huggingface.co/blog/feed.xml", "https://techcrunch.com/category/artificial-intelligence/feed/"],
    hnQueries: ["LLM", "model release", "open weights"],
  },
  "ai-usecases": {
    label: "Real AI use cases",
    angle: "Describe one concrete use case, how it works in simple words, and how the reader could use or build something similar.",
    feeds: ["https://techcrunch.com/category/artificial-intelligence/feed/", "https://github.blog/feed/"],
    hnQueries: ["AI agent", "built with AI"],
  },
  dotnet: {
    label: ".NET & backend",
    angle: "Explain what changed and whether a backend developer should care. Give one practical tip.",
    feeds: ["https://devblogs.microsoft.com/dotnet/feed/", "https://andrewlock.net/rss.xml"],
    hnQueries: [".NET", "C#", "backend", "Postgres"],
  },
  webdev: {
    label: "Web development",
    angle: "Explain the change for frontend and full-stack developers and give one practical takeaway.",
    feeds: ["https://www.smashingmagazine.com/feed/", "https://css-tricks.com/feed/"],
    hnQueries: ["JavaScript", "React", "TypeScript", "CSS"],
  },
  "cloud-devops": {
    label: "Cloud & DevOps",
    angle: "What happened, what it means for teams running production systems, and one lesson.",
    feeds: ["https://aws.amazon.com/blogs/aws/feed/", "https://blog.cloudflare.com/rss/"],
    hnQueries: ["Kubernetes", "AWS", "outage", "DevOps"],
  },
  security: {
    label: "Cybersecurity",
    angle: "Explain the incident or risk in plain words and give practical advice to protect yourself or your company.",
    feeds: ["https://feeds.feedburner.com/TheHackersNews", "https://krebsonsecurity.com/feed/"],
    hnQueries: ["vulnerability", "breach", "security"],
  },
  fintech: {
    label: "What's happening in fintech",
    angle: "Explain the news and what it means for users and builders, especially in India (UPI, RBI, payments, lending).",
    feeds: ["https://techcrunch.com/category/fintech/feed/", "https://www.finextra.com/rss/headlines.aspx", "https://inc42.com/feed/"],
    hnQueries: ["fintech", "payments", "Stripe", "banks"],
  },
  startups: {
    label: "Startups & fundraising",
    angle: "Who raised money or launched, why it matters, and one lesson for founders and builders.",
    feeds: ["https://techcrunch.com/category/startups/feed/", "https://techcrunch.com/category/venture/feed/", "https://inc42.com/feed/", "https://yourstory.com/feed"],
    hnQueries: ["raises", "Show HN"],
  },
  product: {
    label: "Product management",
    angle: "Share a product lesson: what the team did, why it worked or failed, and what PMs can copy.",
    feeds: ["https://www.lennysnewsletter.com/feed", "https://www.producthunt.com/feed"],
    hnQueries: ["product management", "launch"],
  },
  marketing: {
    label: "Marketing & growth",
    angle: "Explain the trend or platform change and give one actionable growth tip.",
    feeds: ["https://www.socialmediatoday.com/feeds/news/", "https://www.marketingdive.com/feeds/news/"],
    hnQueries: ["marketing", "growth", "SEO"],
  },
  career: {
    label: "Career tips",
    angle: "Give one actionable career tip connected to today's news (hiring, layoffs, skills in demand, interviews).",
    feeds: ["https://newsletter.pragmaticengineer.com/feed"],
    hnQueries: ["career", "hiring", "layoffs"],
  },
  "tech-news": {
    label: "Big tech news",
    angle: "Explain the biggest tech story simply and share an opinion on what it means for regular people.",
    feeds: ["https://www.theverge.com/rss/index.xml", "https://techcrunch.com/feed/"],
    hnQueries: ["Apple", "Google", "Microsoft", "OpenAI"],
  },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as string[]).includes(value);
}

// Rotate through the workspace's chosen topics, one per day.
export function categoryForToday(topics: string[], timezone: string, now = new Date()): CategoryId {
  const valid = topics.filter(isCategoryId);
  if (!valid.length) return "ai-models";
  const day = Number(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, day: "numeric" }).format(now));
  return valid[day % valid.length];
}
