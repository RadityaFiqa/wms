import type { AnalyticsUnitGroup } from "@bulog-wms/schema";
import { formatProductName, formatQty } from "@/components/analytics/format";
import {
  formatStackNumber,
  formatStackTotals,
  type StackMapAreaLayout,
  type StackMapStack,
} from "@/components/analytics/stack-map";

// Drawn on a canvas (no screenshot library), always in the light theme so prints look the same
const SCALE = 2;
const PAD = 32;
const GAP = 10;
const CELL_W = 214;
const CARD_H = 142;
const NUMBER_W = 40;
const ROW_HEAD_H = 32;
const FOOTER_H = 44;
const STRIPE_W = 6;
const LINE_W = 2;
const FONT = '"Inter", "Segoe UI", Arial, sans-serif';
const MONO = '"JetBrains Mono", Consolas, monospace';

const COLORS = {
  page: "#ffffff",
  frame: "#f8fafc",
  frameBorder: "#94a3b8",
  border: "#64748b",
  dashed: "#94a3b8",
  title: "#0f172a",
  text: "#334155",
  muted: "#64748b",
  faint: "#94a3b8",
  brand: "#1d4ed8",
  brandSoft: "#eff6ff",
  head: "#1e293b",
  headText: "#ffffff",
  qtyBg: "#f1f5f9",
  note: "#92400e",
  noteBg: "#fef3c7",
};

/** Product colors, assigned by quantity in the area so the biggest products get the clearest ones */
const PRODUCT_COLORS = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#e11d48",
  "#0891b2",
  "#ea580c",
  "#65a30d",
  "#db2777",
  "#4f46e5",
  "#0d9488",
  "#a16207",
];
const OTHER_COLOR = "#94a3b8";

interface ProductSummary {
  productUuid: string;
  sku: string;
  name: string;
  color: string;
  sacks: number;
  totals: (AnalyticsUnitGroup & { displayQty: number })[];
  stackCount: number;
}

/** Cuts the text with "…" so it fits in maxWidth */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end--;
  return `${text.slice(0, end)}…`;
}

/** Word-wraps the text over at most maxLines lines, the last one cut with "…" */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const lines: string[] = [];
  let line = "";
  const words = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    if (lines.length === maxLines - 1) {
      lines.push(fit(ctx, `${line} ${words.slice(i).join(" ")}`, maxWidth));
      return lines;
    }
    lines.push(line);
    line = words[i];
  }
  if (line) lines.push(fit(ctx, line, maxWidth));
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Pill with text, returns its width */
function drawChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colors: { bg: string; fg: string },
) {
  ctx.font = `600 12px ${FONT}`;
  const w = ctx.measureText(text).width + 20;
  roundRect(ctx, x, y, w, 24, 12);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.fillStyle = colors.fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 10, y + 12.5);
  ctx.textBaseline = "top";
  return w;
}

/** Every stack drawn on the image, in reading order */
const areaStacks = (layout: StackMapAreaLayout) => [
  ...layout.lines.flatMap((l) => l.cells.flatMap((c) => c.stacks)),
  ...layout.others,
];

/** Products of the area with their color and totals, biggest first */
function summarizeProducts(layout: StackMapAreaLayout): ProductSummary[] {
  const byProduct = new Map<string, Omit<ProductSummary, "color">>();
  for (const stack of areaStacks(layout)) {
    for (const p of stack.products) {
      let entry = byProduct.get(p.productUuid);
      if (!entry) {
        entry = { productUuid: p.productUuid, sku: p.sku, name: p.name, sacks: 0, totals: [], stackCount: 0 };
        byProduct.set(p.productUuid, entry);
      }
      entry.sacks += p.sacks;
      entry.stackCount += 1;
      const total = entry.totals.find((t) => t.key === p.unit.key);
      if (total) total.displayQty += p.displayQty;
      else entry.totals.push({ ...p.unit, displayQty: p.displayQty });
    }
  }
  const weight = (s: Omit<ProductSummary, "color">) => s.totals.reduce((sum, t) => sum + t.displayQty, 0);
  return Array.from(byProduct.values())
    .sort((a, b) => weight(b) - weight(a) || a.sku.localeCompare(b.sku))
    .map((s, i) => ({ ...s, color: PRODUCT_COLORS[i] ?? OTHER_COLOR }));
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  stack: StackMapStack,
  colors: Map<string, string>,
  x: number,
  y: number,
  width: number,
) {
  const left = x + STRIPE_W + 10;
  const inner = width - STRIPE_W - 20;

  ctx.save();
  roundRect(ctx, x, y, width, CARD_H, 10);
  ctx.fillStyle = COLORS.page;
  ctx.fill();
  ctx.clip();

  // Color stripe split by each product's share of the stack
  const total = stack.products.reduce((sum, p) => sum + Math.max(p.displayQty, 0), 0);
  let stripeY = y;
  stack.products.forEach((p, i) => {
    const share = total > 0 ? Math.max(p.displayQty, 0) / total : 1 / stack.products.length;
    const h = i === stack.products.length - 1 ? y + CARD_H - stripeY : CARD_H * share;
    ctx.fillStyle = colors.get(p.productUuid) ?? OTHER_COLOR;
    ctx.fillRect(x, stripeY, STRIPE_W, h);
    stripeY += h;
  });

  // Quantity band at the bottom
  ctx.fillStyle = COLORS.qtyBg;
  ctx.fillRect(x, y + CARD_H - 30, width, 30);
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(x, y + CARD_H - 31, width, 1.5);
  ctx.restore();

  roundRect(ctx, x, y, width, CARD_H, 10);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = LINE_W;
  ctx.stroke();

  ctx.textBaseline = "top";
  ctx.fillStyle = COLORS.faint;
  ctx.font = `11px ${MONO}`;
  ctx.fillText(fit(ctx, stack.code, inner), left, y + 9);

  const title = stack.label?.title;
  ctx.fillStyle = title ? COLORS.title : COLORS.faint;
  ctx.font = title ? `bold 14px ${FONT}` : `italic 13px ${FONT}`;
  ctx.fillText(fit(ctx, title || "Tanpa judul", inner), left, y + 25);

  const [first, ...rest] = stack.products;
  if (first) {
    ctx.fillStyle = colors.get(first.productUuid) ?? OTHER_COLOR;
    ctx.font = `bold 11px ${MONO}`;
    ctx.fillText(fit(ctx, `${first.sku}${rest.length > 0 ? `  +${rest.length} SKU` : ""}`, inner), left, y + 46);

    ctx.fillStyle = COLORS.text;
    ctx.font = `11px ${FONT}`;
    wrapLines(ctx, formatProductName(first.name), inner, 2).forEach((line, i) =>
      ctx.fillText(line, left, y + 62 + i * 14),
    );
  }

  const note = stack.label?.note;
  if (note) {
    roundRect(ctx, left - 3, y + 92, inner + 6, 18, 5);
    ctx.fillStyle = COLORS.noteBg;
    ctx.fill();
    ctx.fillStyle = COLORS.note;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(fit(ctx, `Catatan: ${note}`, inner - 4), left + 2, y + 95);
  }

  ctx.fillStyle = COLORS.title;
  ctx.font = `bold 12px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(fit(ctx, formatStackTotals(stack.totals, stack.sacks), inner), left, y + CARD_H - 15);
  ctx.textBaseline = "top";
}

function drawEmpty(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, width: number) {
  roundRect(ctx, x + 0.5, y + 0.5, width - 1, CARD_H - 1, 10);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = COLORS.dashed;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.faint;
  ctx.font = `11px ${MONO}`;
  ctx.fillText(label, x + width / 2, y + CARD_H / 2 - 16);
  ctx.font = `12px ${FONT}`;
  ctx.fillText("Kosong", x + width / 2, y + CARD_H / 2 + 2);
  ctx.textAlign = "left";
}

/** Draws the area map on a canvas */
export function renderStackMapCanvas(layout: StackMapAreaLayout, warehouseName: string, printedAt = new Date()) {
  const products = summarizeProducts(layout);
  const colors = new Map(products.map((p) => [p.productUuid, p.color]));

  // Stacks sharing one number (B03.1.1, B03.1.2) sit side by side, so a row letter is
  // as wide as its most stacks on one number
  const rowW = layout.rowWidths.map((n) => n * CELL_W + (n - 1) * GAP);
  const gridInnerW = rowW.reduce((sum, w) => sum + w + GAP, 0) - GAP;
  const gridW = NUMBER_W + Math.max(CELL_W, gridInnerW);
  const contentW = Math.max(gridW, 640);
  const width = PAD * 2 + 32 + contentW;
  const frameX = PAD;
  const frameW = width - PAD * 2;
  const gridX = frameX + 16 + (contentW - gridW) / 2;
  const rowX = rowW.map((_, i) => gridX + NUMBER_W + rowW.slice(0, i).reduce((sum, w) => sum + w + GAP, 0));

  const columns = Math.max(1, Math.floor((contentW - NUMBER_W + GAP) / (CELL_W + GAP)));
  const otherRows = Math.ceil(layout.others.length / columns);
  const gridH = layout.lines.length > 0 ? ROW_HEAD_H + GAP + layout.lines.length * (CARD_H + GAP) - GAP : 0;
  const othersH = otherRows > 0 ? (gridH > 0 ? 20 : 0) + 24 + otherRows * (CARD_H + GAP) - GAP : 0;
  const frameH = 32 + gridH + othersH;

  const legendCols = Math.max(1, Math.floor(frameW / 340));
  const legendRows = Math.ceil(products.length / legendCols);
  const legendH = products.length > 0 ? 36 + legendRows * 40 : 0;

  const headerH = 112;
  const height = PAD + headerH + frameH + (legendH > 0 ? 24 + legendH : 0) + 16 + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round(height * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "top";

  ctx.fillStyle = COLORS.page;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = COLORS.brand;
  ctx.fillRect(0, 0, width, 6);

  // Header: title, warehouse and date, then summary chips
  let y = PAD;
  ctx.fillStyle = COLORS.brand;
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText("PETA TUMPUKAN", PAD, y);
  ctx.fillStyle = COLORS.title;
  ctx.font = `bold 28px ${FONT}`;
  ctx.fillText(fit(ctx, layout.area, width * 0.55), PAD, y + 18);

  const dateText = printedAt.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.title;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText(fit(ctx, warehouseName || "-", width * 0.4), width - PAD, y + 4);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `12px ${FONT}`;
  ctx.fillText(`Per ${dateText}`, width - PAD, y + 24);
  ctx.textAlign = "left";

  let chipX = PAD;
  const chipY = y + 62;
  const chips = [
    { text: `${layout.stackCount} tumpukan`, bg: COLORS.brandSoft, fg: COLORS.brand },
    ...(layout.sacks > 0 ? [{ text: `${formatQty(layout.sacks)} sak`, bg: COLORS.qtyBg, fg: COLORS.title }] : []),
    { text: formatStackTotals(layout.totals, 0), bg: COLORS.qtyBg, fg: COLORS.title },
    ...(layout.rows.length > 0 ? [{ text: `Baris ${layout.rows.join(" - ")}`, bg: COLORS.qtyBg, fg: COLORS.muted }] : []),
  ];
  for (const chip of chips) chipX += drawChip(ctx, chip.text, chipX, chipY, chip) + 8;
  y += headerH;

  // Map frame
  roundRect(ctx, frameX, y, frameW, frameH, 14);
  ctx.fillStyle = COLORS.frame;
  ctx.fill();
  ctx.strokeStyle = COLORS.frameBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  let gy = y + 16;

  if (layout.lines.length > 0) {
    // Row letters left to right
    layout.rows.forEach((row, i) => {
      roundRect(ctx, rowX[i], gy, rowW[i], ROW_HEAD_H, 8);
      ctx.fillStyle = COLORS.head;
      ctx.fill();
      ctx.fillStyle = COLORS.headText;
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`Baris ${row}`, rowX[i] + rowW[i] / 2, gy + ROW_HEAD_H / 2 + 0.5);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
    });
    gy += ROW_HEAD_H + GAP;

    // Numbers top to bottom
    for (const line of layout.lines) {
      const cx = gridX + (NUMBER_W - GAP) / 2;
      ctx.beginPath();
      ctx.arc(cx, gy + CARD_H / 2, 14, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.page;
      ctx.fill();
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(formatStackNumber(line.number), cx, gy + CARD_H / 2 + 0.5);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      line.cells.forEach((cell, i) => {
        if (cell.stacks.length === 0) {
          drawEmpty(ctx, `${cell.row}${formatStackNumber(cell.number)}`, rowX[i], gy, rowW[i]);
        } else {
          // Share the row width between the stacks on this number
          const n = cell.stacks.length;
          const w = (rowW[i] - (n - 1) * GAP) / n;
          cell.stacks.forEach((s, j) => drawCard(ctx, s, colors, rowX[i] + j * (w + GAP), gy, w));
        }
      });
      gy += CARD_H + GAP;
    }
    gy -= GAP;
  }

  if (layout.others.length > 0) {
    if (layout.lines.length > 0) gy += 20;
    ctx.fillStyle = COLORS.muted;
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText("LOKASI LAIN", gridX, gy + 4);
    gy += 24;
    layout.others.forEach((s, i) => {
      drawCard(
        ctx,
        s,
        colors,
        gridX + (i % columns) * (CELL_W + GAP),
        gy + Math.floor(i / columns) * (CARD_H + GAP),
        CELL_W,
      );
    });
  }
  y += frameH;

  // Legend: each product's color with its total in this area
  if (products.length > 0) {
    y += 24;
    ctx.fillStyle = COLORS.title;
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText("Keterangan produk", PAD, y);
    y += 30;
    const colW = (frameW - (legendCols - 1) * 16) / legendCols;
    products.forEach((p, i) => {
      const lx = PAD + (i % legendCols) * (colW + 16);
      const ly = y + Math.floor(i / legendCols) * 40;
      roundRect(ctx, lx, ly + 2, 14, 30, 4);
      ctx.fillStyle = p.color;
      ctx.fill();
      const textX = lx + 24;
      const textW = colW - 24;
      const qty = `${formatStackTotals(p.totals, p.sacks)} · ${p.stackCount} tumpukan`;
      ctx.font = `bold 11px ${MONO}`;
      ctx.fillStyle = COLORS.title;
      ctx.fillText(fit(ctx, p.sku, textW * 0.4), textX, ly + 1);
      const skuW = Math.min(ctx.measureText(p.sku).width, textW * 0.4);
      ctx.font = `11px ${FONT}`;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(fit(ctx, qty, textW - skuW - 10), textX + skuW + 10, ly + 1);
      ctx.fillStyle = COLORS.text;
      ctx.fillText(fit(ctx, formatProductName(p.name), textW), textX, ly + 18);
    });
    y += legendRows * 40 - 4;
  }

  // Footer
  y = height - FOOTER_H;
  ctx.fillStyle = COLORS.frameBorder;
  ctx.fillRect(PAD, y, width - PAD * 2, 1);
  ctx.fillStyle = COLORS.faint;
  ctx.font = `11px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Bulog WMS · Visualization · Peta tumpukan", PAD, y + FOOTER_H / 2);
  ctx.textAlign = "right";
  ctx.fillText("Kuantum dari stok ERP saat ini, termasuk gate belum diadministrasikan", width - PAD, y + FOOTER_H / 2);
  ctx.textAlign = "left";

  return canvas;
}

/** Draws the area map and returns it as a PNG blob */
export function renderStackMapImage(layout: StackMapAreaLayout, warehouseName: string): Promise<Blob> {
  const canvas = renderStackMapCanvas(layout, warehouseName);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat gambar"))), "image/png"),
  );
}

/** Saves the area map as peta-tumpukan-<area>-<date>.png */
export async function downloadStackMapImage(layout: StackMapAreaLayout, warehouseName: string) {
  const blob = await renderStackMapImage(layout, warehouseName);
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const slug = layout.area.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `peta-tumpukan-${slug || "area"}-${date}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
