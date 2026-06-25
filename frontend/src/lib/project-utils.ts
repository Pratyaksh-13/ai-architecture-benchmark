// Shared constants and utilities for project detail pages

import { projects as projectsApi } from "@/lib/api";

export const ARCH_META: Record<string, { title: string; num: string }> = {
  monolithic:   { title: "Monolithic",   num: "01" },
  microservices:{ title: "Microservices",num: "02" },
  event_driven: { title: "Event-driven", num: "03" },
};

export const AXIS_STYLE = {
  fontSize: 11,
  fontFamily: "JetBrains Mono",
  fill: "#6B6558",
} as const;

export const TOOLTIP_STYLE = {
  background: "#F2EFE6",
  border: "1px solid #1B2330",
  borderRadius: 0,
  fontFamily: "JetBrains Mono",
  fontSize: 12,
} as const;

export const LEGEND_STYLE = {
  fontFamily: "JetBrains Mono",
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: "0.12em",
} as const;

export const SEVERITY_COLOR: Record<string, string> = {
  critical: "#B8472E",
  high:     "#D97706",
  medium:   "#9A8A3A",
  low:      "#6B6558",
};

export function relativeTime(iso: string): string {
  const diffMs  = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export async function downloadMarkdown(id: number) {
  const text = await projectsApi.reportMarkdown(id);
  const blob  = new Blob(
    [typeof text === "string" ? text : JSON.stringify(text)],
    { type: "text/markdown" },
  );
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = `project-${id}-report.md`; a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPdf(id: number) {
  const res = await projectsApi.reportPdf(id);
  if (!res.ok) { alert("PDF generation failed"); return; }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `project-${id}-report.pdf`; a.click();
  URL.revokeObjectURL(url);
}
