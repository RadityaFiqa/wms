import type { AnalyticsUnitGroup } from "@bulog-wms/schema";
import { formatProductName, formatQty } from "@/components/analytics/format";
import {
  formatStackNumber,
  formatStackTotals,
  type StackMapAreaLayout,
  type StackMapProduct,
  type StackMapStack,
} from "@/components/analytics/stack-map";

// Drawn on a canvas (no screenshot library), always in the light theme so prints look the same.
// No text is ever cut: it wraps, and cards, rows and the legend grow to fit it.
const SCALE = 2;
const PAD = 32;
const GAP = 10;
/** Card width range; the one that makes the page smallest is used */
const CELL_MIN_W = 240;
const CELL_MAX_W = 520;
/** Smallest card, so short cards still line up as a grid */
const CARD_MIN_H = 150;
const NUMBER_W = 46;
const ROW_HEAD_H = 40;
const FOOTER_H = 44;
const STRIPE_W = 6;
const LINE_W = 2;
const CARD_PAD_X = 10;
const FONT = '"Inter", "Segoe UI", Arial, sans-serif';
const MONO = '"JetBrains Mono", Consolas, monospace';

const COLORS = {
  page: "#ffffff",
  frame: "#f8fafc",
  frameBorder: "#94a3b8",
  border: "#64748b",
  dashed: "#94a3b8",
  title: "#0f172a",
  text: "#1e293b",
  muted: "#475569",
  brand: "#1d4ed8",
  brandSoft: "#eff6ff",
  head: "#1e293b",
  headText: "#ffffff",
  qtyBg: "#f1f5f9",
  note: "#78350f",
  noteBg: "#fef3c7",
};

/** Product colors, assigned by quantity in the area so the biggest products get the clearest ones */
const PRODUCT_COLORS = [
  "#1d4ed8",
  "#047857",
  "#b45309",
  "#6d28d9",
  "#be123c",
  "#0e7490",
  "#c2410c",
  "#4d7c0f",
  "#be185d",
  "#4338ca",
  "#0f766e",
  "#854d0e",
];
const OTHER_COLOR = "#475569";

/** Fonts and line heights, shared by measuring and drawing so both agree */
const TEXT = {
  code: { font: `bold 14px ${MONO}`, lineH: 18, color: COLORS.muted },
  title: { font: `bold 19px ${FONT}`, lineH: 24, color: COLORS.title },
  untitled: { font: `italic 16px ${FONT}`, lineH: 21, color: COLORS.muted },
  sku: { font: `bold 15px ${MONO}`, lineH: 20 },
  productQty: { font: `600 15px ${FONT}`, lineH: 20, color: COLORS.text },
  name: { font: `15px ${FONT}`, lineH: 20, color: COLORS.text },
  note: { font: `15px ${FONT}`, lineH: 20, color: COLORS.note },
  total: { font: `bold 17px ${FONT}`, lineH: 22, color: COLORS.title },
} as const;

type TextStyle = { font: string; lineH: number; color?: string };

interface ProductSummary {
  productUuid: string;
  sku: string;
  name: string;
  color: string;
  sacks: number;
  totals: (AnalyticsUnitGroup & { displayQty: number })[];
  stackCount: number;
}

/**
 * Word-wraps the text to maxWidth without dropping anything; a word longer than the
 * line is split by characters
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  const push = (word: string) => {
    // Split a word that cannot fit on a line of its own
    let rest = word;
    while (ctx.measureText(rest).width > maxWidth && rest.length > 1) {
      let end = rest.length - 1;
      while (end > 1 && ctx.measureText(rest.slice(0, end)).width > maxWidth) end--;
      lines.push(rest.slice(0, end));
      rest = rest.slice(end);
    }
    return rest;
  };
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = push(word);
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  // Lines and quadratic corners only, which the PDF context draws the same way as the canvas
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
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
  ctx.font = `600 16px ${FONT}`;
  const w = ctx.measureText(text).width + 26;
  roundRect(ctx, x, y, w, 32, 16);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.fillStyle = colors.fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 13, y + 16.5);
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

/** A run of wrapped lines in one style */
interface TextBlock {
  style: TextStyle;
  color: string;
  lines: string[];
  /** Space before the block */
  gapBefore: number;
}

const blockHeight = (b: TextBlock) => b.gapBefore + b.lines.length * b.style.lineH;

function block(
  ctx: CanvasRenderingContext2D,
  style: TextStyle,
  text: string,
  width: number,
  gapBefore = 0,
  color = style.color ?? COLORS.text,
): TextBlock {
  ctx.font = style.font;
  return { style, color, lines: wrapText(ctx, text, width), gapBefore };
}

const productQty = (p: StackMapProduct) => formatStackTotals([{ ...p.unit, displayQty: p.displayQty }], p.sacks);

/** Everything written on a card, wrapped to its width, and the height it needs */
function layoutCard(ctx: CanvasRenderingContext2D, stack: StackMapStack, colors: Map<string, string>, width: number) {
  const inner = width - STRIPE_W - CARD_PAD_X * 2;
  const body: TextBlock[] = [block(ctx, TEXT.code, stack.code, inner)];
  const title = stack.label?.title;
  body.push(title ? block(ctx, TEXT.title, title, inner, 2) : block(ctx, TEXT.untitled, "Tanpa judul", inner, 2));

  // Every product of the stack, with its own quantity when there are several
  const several = stack.products.length > 1;
  stack.products.forEach((p, i) => {
    const color = colors.get(p.productUuid) ?? OTHER_COLOR;
    body.push(block(ctx, TEXT.sku, p.sku, inner, i === 0 ? 6 : 8, color));
    if (several) body.push(block(ctx, TEXT.productQty, productQty(p), inner));
    body.push(block(ctx, TEXT.name, formatProductName(p.name), inner, 1));
  });

  const note = stack.label?.note ? block(ctx, TEXT.note, `Catatan: ${stack.label.note}`, inner - 8) : null;
  const total = block(ctx, TEXT.total, formatStackTotals(stack.totals, stack.sacks), inner);

  const bodyH = 10 + body.reduce((sum, b) => sum + blockHeight(b), 0);
  const noteH = note ? 8 + blockHeight(note) + 8 : 0;
  const bandH = blockHeight(total) + 14;
  return { body, note, total, bandH, height: bodyH + noteH + 10 + bandH };
}

function drawBlocks(ctx: CanvasRenderingContext2D, blocks: TextBlock[], x: number, y: number) {
  ctx.textBaseline = "top";
  let cy = y;
  for (const b of blocks) {
    cy += b.gapBefore;
    ctx.font = b.style.font;
    ctx.fillStyle = b.color;
    for (const line of b.lines) {
      ctx.fillText(line, x, cy + 1);
      cy += b.style.lineH;
    }
  }
  return cy;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  stack: StackMapStack,
  colors: Map<string, string>,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const card = layoutCard(ctx, stack, colors, width);
  const left = x + STRIPE_W + CARD_PAD_X;

  ctx.save();
  roundRect(ctx, x, y, width, height, 10);
  ctx.fillStyle = COLORS.page;
  ctx.fill();
  ctx.clip();

  // Color stripe split by each product's share of the stack
  const total = stack.products.reduce((sum, p) => sum + Math.max(p.displayQty, 0), 0);
  let stripeY = y;
  stack.products.forEach((p, i) => {
    const share = total > 0 ? Math.max(p.displayQty, 0) / total : 1 / stack.products.length;
    const h = i === stack.products.length - 1 ? y + height - stripeY : height * share;
    ctx.fillStyle = colors.get(p.productUuid) ?? OTHER_COLOR;
    ctx.fillRect(x, stripeY, STRIPE_W, h);
    stripeY += h;
  });

  // Quantity band at the bottom
  ctx.fillStyle = COLORS.qtyBg;
  ctx.fillRect(x, y + height - card.bandH, width, card.bandH);
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(x, y + height - card.bandH - 1, width, 1.5);
  ctx.restore();

  roundRect(ctx, x, y, width, height, 10);
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = LINE_W;
  ctx.stroke();

  const afterBody = drawBlocks(ctx, card.body, left, y + 10);
  if (card.note) {
    const noteY = afterBody + 8;
    roundRect(ctx, left - 4, noteY - 4, width - STRIPE_W - CARD_PAD_X * 2 + 8, blockHeight(card.note) + 8, 5);
    ctx.fillStyle = COLORS.noteBg;
    ctx.fill();
    drawBlocks(ctx, [card.note], left, noteY);
  }
  drawBlocks(ctx, [card.total], left, y + height - card.bandH + 7);
}

function drawEmpty(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, width: number, height: number) {
  roundRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, 10);
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = COLORS.dashed;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.muted;
  ctx.font = `bold 14px ${MONO}`;
  ctx.fillText(label, x + width / 2, y + height / 2 - 20);
  ctx.font = `15px ${FONT}`;
  ctx.fillText("Kosong", x + width / 2, y + height / 2 + 2);
  ctx.textAlign = "left";
}

/** Width of the product legend beside the map */
const LEGEND_W = 400;
/** Every export has the same 16:9 shape, whatever the size of the gudang */
const RATIO = 16 / 9;
const MIN_WIDTH = 1600;

/** Lines of one legend entry and its height */
function layoutLegendItem(ctx: CanvasRenderingContext2D, p: ProductSummary, width: number) {
  const blocks = [
    block(ctx, TEXT.sku, p.sku, width, 0, p.color),
    block(ctx, TEXT.productQty, `${formatStackTotals(p.totals, p.sacks)} · ${p.stackCount} tumpukan`, width, 1),
    block(ctx, TEXT.name, formatProductName(p.name), width, 1),
  ];
  return { blocks, height: blocks.reduce((sum, b) => sum + blockHeight(b), 0) };
}

/** Where to draw: measure is used to size text before the page exists, create makes the page */
interface Surface {
  measure: CanvasRenderingContext2D;
  create: (width: number, height: number) => CanvasRenderingContext2D;
}

/**
 * Draws the area map on a 16:9 page: header, map with the product legend beside it, footer.
 * The surface is a canvas for the PNG, or the jsPDF 2D context for a vector PDF that stays
 * sharp when zoomed.
 */
function paintStackMap(layout: StackMapAreaLayout, warehouseName: string, printedAt: Date, surface: Surface) {
  const m = surface.measure;
  const products = summarizeProducts(layout);
  const colors = new Map(products.map((p) => [p.productUuid, p.color]));

  // Lays the page out for one card width
  const measurePage = (cellW: number) => {
    // Stacks sharing one number (B03.1.1, B03.1.2) sit side by side, so a row letter is
    // as wide as its most stacks on one number
    const rowW = layout.rowWidths.map((n) => n * cellW + (n - 1) * GAP);
    const gridInnerW = rowW.reduce((sum, w) => sum + w + GAP, 0) - GAP;
    const gridW = NUMBER_W + Math.max(cellW, gridInnerW);
    const contentW = Math.max(gridW, 520);
    const frameW = contentW + 32;

    // Card heights: every card of a number line as tall as its longest one
    const stackWidth = (cellStacks: number, i: number) => {
      const perLine = Math.min(cellStacks, layout.rowWidths[i]);
      return (rowW[i] - (perLine - 1) * GAP) / perLine;
    };
    const lineCardH = layout.lines.map((line) =>
      Math.max(
        CARD_MIN_H,
        ...line.cells.flatMap((cell, i) =>
          cell.stacks.map((s) => layoutCard(m, s, colors, stackWidth(cell.stacks.length, i)).height),
        ),
      ),
    );
    const lineH = layout.lines.map((line, i) => line.stackRows * lineCardH[i] + (line.stackRows - 1) * GAP);
    const othersCardH = Math.max(CARD_MIN_H, ...layout.others.map((s) => layoutCard(m, s, colors, cellW).height));

    const columns = Math.max(1, Math.floor((contentW - NUMBER_W + GAP) / (cellW + GAP)));
    const otherRows = Math.ceil(layout.others.length / columns);
    const gridH =
      layout.lines.length > 0 ? ROW_HEAD_H + GAP + lineH.reduce((sum, h) => sum + h + GAP, 0) - GAP : 0;
    const othersH = otherRows > 0 ? (gridH > 0 ? 20 : 0) + 26 + otherRows * (othersCardH + GAP) - GAP : 0;
    const frameH = 32 + gridH + othersH;

    const bodyW = frameW + (hasLegend ? 24 + LEGEND_W : 0);
    const bodyH = Math.max(frameH, legendH);
    const naturalW = PAD * 2 + bodyW;
    const naturalH = PAD + headerH + bodyH + 24 + FOOTER_H;

    // Grow the page to 16:9 around the content, never shrink the content
    let width = Math.max(naturalW, naturalH * RATIO, MIN_WIDTH);
    let height = width / RATIO;
    if (height < naturalH) {
      height = naturalH;
      width = height * RATIO;
    }
    width = Math.round(width);
    height = Math.round(width / RATIO);
    return {
      cellW, rowW, gridW, contentW, frameW, stackWidth, lineCardH, lineH, othersCardH,
      columns, frameH, bodyW, bodyH, width, height,
    };
  };

  const hasLegend = products.length > 0;
  const legendTextW = LEGEND_W - 32 - 20;
  const legendItems = products.map((p) => layoutLegendItem(m, p, legendTextW));
  const legendH = hasLegend ? 56 + legendItems.reduce((sum, it) => sum + it.height + 18, 0) : 0;
  const headerH = 130;

  // Widest cards that keep the page smallest: the 16:9 space is used for wider cards
  // (fewer wrapped lines) instead of white margins, so text is as large as possible
  let page = measurePage(CELL_MIN_W);
  for (let cellW = CELL_MIN_W + 20; cellW <= CELL_MAX_W; cellW += 20) {
    const candidate = measurePage(cellW);
    if (candidate.width <= page.width) page = candidate;
  }
  const {
    cellW, rowW, gridW, contentW, frameW, stackWidth, lineCardH, lineH, othersCardH,
    columns, frameH, bodyW, bodyH, width, height,
  } = page;

  const ctx = surface.create(width, height);
  ctx.textBaseline = "top";

  ctx.fillStyle = COLORS.brand;
  ctx.fillRect(0, 0, width, 6);

  // Header across the page: title, warehouse and date, then summary chips
  const top = PAD;
  ctx.fillStyle = COLORS.brand;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText("PETA TUMPUKAN", PAD, top);
  ctx.fillStyle = COLORS.title;
  ctx.font = `bold 38px ${FONT}`;
  ctx.fillText(layout.area, PAD, top + 20);

  const dateText = printedAt.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.title;
  ctx.font = `600 18px ${FONT}`;
  ctx.fillText(warehouseName || "-", width - PAD, top + 4);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `15px ${FONT}`;
  ctx.fillText(`Per ${dateText}`, width - PAD, top + 28);
  ctx.textAlign = "left";

  let chipX = PAD;
  const chips = [
    { text: `${layout.stackCount} tumpukan`, bg: COLORS.brandSoft, fg: COLORS.brand },
    ...(layout.sacks > 0 ? [{ text: `${formatQty(layout.sacks)} sak`, bg: COLORS.qtyBg, fg: COLORS.title }] : []),
    { text: formatStackTotals(layout.totals, 0), bg: COLORS.qtyBg, fg: COLORS.title },
    ...(layout.rows.length > 0 ? [{ text: `Baris ${layout.rows.join(" - ")}`, bg: COLORS.qtyBg, fg: COLORS.muted }] : []),
  ];
  for (const chip of chips) chipX += drawChip(ctx, chip.text, chipX, top + 74, chip) + 10;

  // Body (map + legend) centred in the space between header and footer
  const bodyTop = top + headerH;
  const bodySpace = height - FOOTER_H - 24 - bodyTop;
  const bodyX = Math.round((width - bodyW) / 2);
  const bodyY = Math.round(bodyTop + Math.max(0, (bodySpace - bodyH) / 2));

  // Map frame
  const frameX = bodyX;
  roundRect(ctx, frameX, bodyY, frameW, bodyH, 14);
  ctx.fillStyle = COLORS.frame;
  ctx.fill();
  ctx.strokeStyle = COLORS.frameBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const gridX = frameX + 16 + (contentW - gridW) / 2;
  const rowX = rowW.map((_, i) => gridX + NUMBER_W + rowW.slice(0, i).reduce((sum, w) => sum + w + GAP, 0));
  let gy = bodyY + 16 + (bodyH - frameH) / 2;

  if (layout.lines.length > 0) {
    // Row letters left to right
    layout.rows.forEach((row, i) => {
      roundRect(ctx, rowX[i], gy, rowW[i], ROW_HEAD_H, 8);
      ctx.fillStyle = COLORS.head;
      ctx.fill();
      ctx.fillStyle = COLORS.headText;
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`Baris ${row}`, rowX[i] + rowW[i] / 2, gy + ROW_HEAD_H / 2 + 0.5);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
    });
    gy += ROW_HEAD_H + GAP;

    // Numbers top to bottom
    layout.lines.forEach((line, li) => {
      const h = lineH[li];
      const cardH = lineCardH[li];
      const cx = gridX + (NUMBER_W - GAP) / 2;
      ctx.beginPath();
      ctx.arc(cx, gy + h / 2, 19, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.page;
      ctx.fill();
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = COLORS.title;
      ctx.font = `bold 16px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(formatStackNumber(line.number), cx, gy + h / 2 + 0.5);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      line.cells.forEach((cell, i) => {
        if (cell.stacks.length === 0) {
          drawEmpty(ctx, `${cell.row}${formatStackNumber(cell.number)}`, rowX[i], gy, rowW[i], h);
        } else {
          // At most rowWidths[i] stacks side by side, sharing the row width; more wrap below
          const perLine = Math.min(cell.stacks.length, layout.rowWidths[i]);
          const w = stackWidth(cell.stacks.length, i);
          cell.stacks.forEach((s, j) =>
            drawCard(
              ctx,
              s,
              colors,
              rowX[i] + (j % perLine) * (w + GAP),
              gy + Math.floor(j / perLine) * (cardH + GAP),
              w,
              cardH,
            ),
          );
        }
      });
      gy += h + GAP;
    });
    gy -= GAP;
  }

  if (layout.others.length > 0) {
    if (layout.lines.length > 0) gy += 20;
    ctx.fillStyle = COLORS.muted;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText("LOKASI LAIN", gridX, gy + 4);
    gy += 26;
    layout.others.forEach((s, i) => {
      drawCard(
        ctx,
        s,
        colors,
        gridX + (i % columns) * (cellW + GAP),
        gy + Math.floor(i / columns) * (othersCardH + GAP),
        cellW,
        othersCardH,
      );
    });
  }

  // Legend beside the map: each product's color with its total in this gudang
  if (hasLegend) {
    const lx = frameX + frameW + 24;
    roundRect(ctx, lx, bodyY, LEGEND_W, bodyH, 14);
    ctx.fillStyle = COLORS.page;
    ctx.fill();
    ctx.strokeStyle = COLORS.frameBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = COLORS.title;
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText("Keterangan produk", lx + 16, bodyY + 18);
    let iy = bodyY + 56;
    legendItems.forEach((item, i) => {
      if (i > 0) {
        ctx.fillStyle = COLORS.qtyBg;
        ctx.fillRect(lx + 16, iy - 10, LEGEND_W - 32, 1.5);
      }
      roundRect(ctx, lx + 16, iy, 8, item.height, 4);
      ctx.fillStyle = products[i].color;
      ctx.fill();
      drawBlocks(ctx, item.blocks, lx + 16 + 20, iy);
      iy += item.height + 18;
    });
  }

  // Footer across the page
  const fy = height - FOOTER_H;
  ctx.fillStyle = COLORS.frameBorder;
  ctx.fillRect(PAD, fy, width - PAD * 2, 1);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `14px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("Bulog WMS · Visualization · Peta tumpukan", PAD, fy + FOOTER_H / 2);
  ctx.textAlign = "right";
  ctx.fillText("Kuantum dari stok ERP saat ini, termasuk gate belum diadministrasikan", width - PAD, fy + FOOTER_H / 2);
  ctx.textAlign = "left";
}

/** Draws the area map on a canvas, SCALE× sharper than its layout size */
export function renderStackMapCanvas(layout: StackMapAreaLayout, warehouseName: string, printedAt = new Date()) {
  const canvas = document.createElement("canvas");
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Canvas tidak tersedia");
  paintStackMap(layout, warehouseName, printedAt, {
    measure,
    create: (width, height) => {
      canvas.width = Math.round(width * SCALE);
      canvas.height = Math.round(height * SCALE);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak tersedia");
      ctx.scale(SCALE, SCALE);
      // White page; the PDF page already is, and a page-sized fill there would add a page
      ctx.fillStyle = COLORS.page;
      ctx.fillRect(0, 0, width, height);
      return ctx;
    },
  });
  return canvas;
}

/** Draws the area map and returns it as a PNG blob */
export function renderStackMapImage(layout: StackMapAreaLayout, warehouseName: string): Promise<Blob> {
  const canvas = renderStackMapCanvas(layout, warehouseName);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Gagal membuat gambar"))), "image/png"),
  );
}

/**
 * Draws the area map as a vector PDF (one 16:9 page, 1 pt per layout pixel), so lines and
 * text stay sharp at any zoom or print size. jsPDF is only loaded when exporting.
 */
export async function renderStackMapPdf(layout: StackMapAreaLayout, warehouseName: string, printedAt = new Date()) {
  const { jsPDF } = await import("jspdf");
  // Text is measured with the PDF's own fonts so wrapping matches what gets drawn
  const measureDoc = new jsPDF({ unit: "pt" });
  let doc: InstanceType<typeof jsPDF> | null = null;
  paintStackMap(layout, warehouseName, printedAt, {
    measure: measureDoc.context2d as unknown as CanvasRenderingContext2D,
    create: (width, height) => {
      doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [width, height], compress: true });
      doc.setProperties({ title: `Peta tumpukan ${layout.area}`, subject: warehouseName, creator: "Bulog WMS" });
      // One page: without this jsPDF moves drawings that touch the bottom edge to a new page
      doc.context2d.autoPaging = false;
      return doc.context2d as unknown as CanvasRenderingContext2D;
    },
  });
  if (!doc) throw new Error("Gagal membuat PDF");
  return (doc as InstanceType<typeof jsPDF>).output("blob");
}

/** peta-tumpukan-<area>-<date>.<ext> */
function exportFileName(layout: StackMapAreaLayout, ext: string) {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const slug = layout.area.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `peta-tumpukan-${slug || "area"}-${date}.${ext}`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/** Saves the area map as a PNG image */
export async function downloadStackMapImage(layout: StackMapAreaLayout, warehouseName: string) {
  saveBlob(await renderStackMapImage(layout, warehouseName), exportFileName(layout, "png"));
}

/** Saves the area map as a vector PDF */
export async function downloadStackMapPdf(layout: StackMapAreaLayout, warehouseName: string) {
  saveBlob(await renderStackMapPdf(layout, warehouseName), exportFileName(layout, "pdf"));
}
