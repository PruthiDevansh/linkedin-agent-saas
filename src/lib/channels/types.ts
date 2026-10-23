import type { ChatRefs } from "../types";

// A button id looks like "post:<draftId>". Labels are short (WhatsApp allows 20 chars).
export type ChatButton = { id: string; label: string };

export type ChatImage = { kind: "png" | "pdf"; bytes: ArrayBuffer | Uint8Array };

// What the shared chat logic needs from Telegram or WhatsApp.
export interface ChatChannel {
  kind: "telegram" | "whatsapp";
  text(text: string): Promise<void>;
  // Ask a question whose answer is the next message (edit text, your idea).
  ask(text: string): Promise<void>;
  // Show a draft with its image and action buttons. Returns message ids to clean up later.
  draft(text: string, buttons: ChatButton[], image?: ChatImage): Promise<ChatRefs>;
  // Remove buttons / old image of a previously shown draft.
  clear(refs: ChatRefs): Promise<void>;
}
