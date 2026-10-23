import { timingSafeEqual } from "node:crypto";

function read(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function required(name: string): string {
  const value = read(name);
  if (!value) throw new Error(`Missing environment variable ${name}. See SETUP.md.`);
  return value;
}

// Server-side configuration. Getters so a missing optional feature only fails when used.
export const env = {
  appName: () => read("NEXT_PUBLIC_APP_NAME") || "Kalam",
  appUrl: () =>
    (read("APP_URL") ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
    ).replace(/\/$/, ""),
  adminEmails: () =>
    read("ADMIN_EMAILS")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),

  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  encryptionKey: () => required("ENCRYPTION_KEY"),

  geminiKey: () => read("GEMINI_API_KEY"),
  geminiModel: () => read("GEMINI_MODEL") || "gemini-flash-latest",
  geminiFallbackModel: () => read("GEMINI_FALLBACK_MODEL") || "gemini-flash-lite-latest",

  linkedinClientId: () => required("LINKEDIN_CLIENT_ID"),
  linkedinClientSecret: () => required("LINKEDIN_CLIENT_SECRET"),
  linkedinVersion: () => read("LINKEDIN_VERSION"),

  telegramToken: () => read("TELEGRAM_BOT_TOKEN"),
  telegramBotUsername: () => read("TELEGRAM_BOT_USERNAME"),
  telegramWebhookSecret: () => required("TELEGRAM_WEBHOOK_SECRET"),

  whatsappToken: () => read("WHATSAPP_TOKEN"),
  whatsappPhoneNumberId: () => read("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappVerifyToken: () => read("WHATSAPP_VERIFY_TOKEN"),
  whatsappAppSecret: () => read("WHATSAPP_APP_SECRET"),

  qstashToken: () => read("QSTASH_TOKEN"),
  qstashCurrentKey: () => read("QSTASH_CURRENT_SIGNING_KEY"),
  qstashNextKey: () => read("QSTASH_NEXT_SIGNING_KEY"),
  cronSecret: () => read("CRON_SECRET"),

  razorpayKeyId: () => read("RAZORPAY_KEY_ID"),
  razorpayKeySecret: () => read("RAZORPAY_KEY_SECRET"),
  razorpayWebhookSecret: () => read("RAZORPAY_WEBHOOK_SECRET"),
  lemonApiKey: () => read("LEMONSQUEEZY_API_KEY"),
  lemonStoreId: () => read("LEMONSQUEEZY_STORE_ID"),
  lemonVariantId: () => read("LEMONSQUEEZY_VARIANT_ID"),
  lemonWebhookSecret: () => read("LEMONSQUEEZY_WEBHOOK_SECRET"),
};

// Constant-time compare so secrets can't be guessed by timing.
export function secretMatches(given: string | null | undefined, expected: string): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
