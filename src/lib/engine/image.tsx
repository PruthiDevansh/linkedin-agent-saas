import { ImageResponse } from "next/og";
import { PDFDocument } from "pdf-lib";
import type { ReactNode } from "react";
import type { ImageTheme, Slide, Visual } from "../types";

// Drawn with Satori (JSX + flexbox -> SVG -> PNG). No paid image AI needed.

const THEMES: Record<ImageTheme, { bg: string; bg2: string; text: string; muted: string; accent: string; onAccent: string; box: string; border: string }> = {
  navy: { bg: "#0b1f33", bg2: "#12395e", text: "#ffffff", muted: "#a9c3dc", accent: "#4fb3ff", onAccent: "#0b1f33", box: "#163f66", border: "#2f6fa8" },
  light: { bg: "#ffffff", bg2: "#eef3fb", text: "#0f172a", muted: "#5b6b82", accent: "#2563eb", onAccent: "#ffffff", box: "#ffffff", border: "#c7d4ea" },
  sunset: { bg: "#2a1036", bg2: "#7a2448", text: "#fff7ef", muted: "#f5c9b8", accent: "#ffb547", onAccent: "#2a1036", box: "#4a1a3e", border: "#a8476a" },
};

type Theme = (typeof THEMES)[ImageTheme];

function Frame(props: { t: Theme; label: string; author: string; width: number; height: number; footerRight?: string; children: ReactNode }) {
  const { t } = props;
  return (
    <div
      style={{
        width: props.width,
        height: props.height,
        display: "flex",
        flexDirection: "column",
        padding: "80px 90px",
        color: t.text,
        backgroundImage: `linear-gradient(160deg, ${t.bg} 0%, ${t.bg2} 100%)`,
      }}
    >
      <div style={{ display: "flex", fontSize: 28, color: t.accent, letterSpacing: 2, textTransform: "uppercase" }}>{props.label}</div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1 }}>{props.children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 30, borderTop: `2px solid ${t.border}`, fontSize: 28, color: t.muted }}>
        <span>{props.author}</span>
        <span>{props.footerRight ?? "Follow for more"}</span>
      </div>
    </div>
  );
}

function Card({ t, visual, author }: { t: Theme; visual: Visual; author: string }) {
  return (
    <Frame t={t} label="Key takeaways" author={author} width={1200} height={1200}>
      <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.15 }}>{visual.title}</div>
      <div style={{ width: 120, height: 8, borderRadius: 4, background: t.accent, marginTop: 44 }} />
      <div style={{ display: "flex", flexDirection: "column", marginTop: 60, gap: 52 }}>
        {visual.points.map((point, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 72, height: 72, flexShrink: 0, borderRadius: 36, background: t.accent, color: t.onAccent, fontSize: 38, fontWeight: 700 }}>
              {i + 1}
            </div>
            <div style={{ display: "flex", fontSize: 48, lineHeight: 1.3, marginTop: 4 }}>{point}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Flowchart({ t, visual, author }: { t: Theme; visual: Visual; author: string }) {
  const n = visual.steps.length;
  return (
    <Frame t={t} label="How it works" author={author} width={1200} height={1200}>
      <div style={{ display: "flex", justifyContent: "center", textAlign: "center", fontSize: 58, fontWeight: 700, lineHeight: 1.15 }}>{visual.title}</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 }}>
        {visual.steps.map((step, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22, width: 820, height: n > 5 ? 84 : 100, padding: "0 34px", borderRadius: 18, background: t.box, border: `3px solid ${t.border}`, fontSize: 38 }}>
              <span style={{ color: t.accent, fontWeight: 700 }}>{i + 1}</span>
              <span>{step}</span>
            </div>
            {i < n - 1 && (
              <svg width="32" height="40" viewBox="0 0 32 40" style={{ margin: "4px 0" }}>
                <rect x="14" y="0" width="4" height="24" fill={t.accent} />
                <polygon points="4,22 28,22 16,38" fill={t.accent} />
              </svg>
            )}
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Quote({ t, visual, author }: { t: Theme; visual: Visual; author: string }) {
  return (
    <Frame t={t} label={visual.title} author={author} width={1200} height={1200}>
      <div style={{ display: "flex", fontSize: 220, lineHeight: 0.6, color: t.accent, height: 120 }}>“</div>
      <div style={{ display: "flex", fontSize: 72, lineHeight: 1.25, fontWeight: 700 }}>{visual.quote}</div>
    </Frame>
  );
}

function SlideView({ t, slide, index, total, author }: { t: Theme; slide: Slide; index: number; total: number; author: string }) {
  const isCover = index === 0;
  return (
    <Frame t={t} label={isCover ? "Swipe →" : `${index + 1} / ${total}`} author={author} width={1080} height={1350} footerRight={index === total - 1 ? "Save & share" : "Swipe for more"}>
      <div style={{ display: "flex", fontSize: isCover ? 92 : 68, fontWeight: 700, lineHeight: 1.12 }}>{slide.title}</div>
      {slide.body && <div style={{ display: "flex", marginTop: 44, fontSize: isCover ? 44 : 46, lineHeight: 1.4, color: isCover ? t.muted : t.text }}>{slide.body}</div>}
    </Frame>
  );
}

async function png(element: ReactNode, width: number, height: number): Promise<ArrayBuffer> {
  return new ImageResponse(element as React.ReactElement, { width, height }).arrayBuffer();
}

export async function renderPostImage(kind: "card" | "flowchart" | "quote", visual: Visual, theme: ImageTheme, author: string) {
  const t = THEMES[theme] ?? THEMES.navy;
  const el =
    kind === "flowchart" ? <Flowchart t={t} visual={visual} author={author} /> : kind === "quote" ? <Quote t={t} visual={visual} author={author} /> : <Card t={t} visual={visual} author={author} />;
  return png(el, 1200, 1200);
}

export async function renderSlide(slides: Slide[], index: number, theme: ImageTheme, author: string) {
  const t = THEMES[theme] ?? THEMES.navy;
  return png(<SlideView t={t} slide={slides[index]} index={index} total={slides.length} author={author} />, 1080, 1350);
}

// All slides as one PDF: LinkedIn shows a PDF document as a swipeable carousel.
export async function renderCarouselPdf(slides: Slide[], theme: ImageTheme, author: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < slides.length; i++) {
    const image = await pdf.embedPng(await renderSlide(slides, i, theme, author));
    const page = pdf.addPage([1080, 1350]);
    page.drawImage(image, { x: 0, y: 0, width: 1080, height: 1350 });
  }
  return pdf.save();
}
