import { Prisma, PrismaClient } from '@prisma/client';
import type { SpkTreatmentType } from '@bulog-wms/schema';

export const SPK_TREATMENT_TYPES: SpkTreatmentType[] = [
  'SPRAYING',
  'FUMIGASI',
  'FOGGING',
];

/** Kartu tumpukan column filled by each treatment */
export const SPK_TREATMENT_FIELD = {
  SPRAYING: 'spraying',
  FUMIGASI: 'fumigasi',
  FOGGING: 'fogging',
} as const;

export type TreatmentDates = Record<
  (typeof SPK_TREATMENT_FIELD)[SpkTreatmentType],
  string | null
>;

/** SPK that do not count as a treatment */
const IGNORED_SPK_STATES = ['cancel'];

export function normalizeText(value?: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Whether an SPK line product (Odoo display_name, usually "[SKU] Name") is the
 * same product as a stack row (name + sku as stored in WMS).
 */
export function spkProductMatches(
  spkProduct: string,
  product: { name?: string | null; sku?: string | null },
): boolean {
  const spk = normalizeText(spkProduct);
  const name = normalizeText(product.name);
  const sku = normalizeText(product.sku);
  if (!spk) return false;

  const skuMatch = spk.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (skuMatch) {
    if (sku && sku !== '-' && normalizeText(skuMatch[1]) === sku) return true;
    if (name && normalizeText(skuMatch[2]) === name) return true;
  }
  return !!name && (spk === name || spk === normalizeText(`[${sku}] ${name}`));
}

/** Calendar day (YYYY-MM-DD) of a moment in the warehouse timezone */
export function toMakassarDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Makassar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Later of two YYYY-MM-DD dates; a value that is not a date loses */
export function laterDate(
  current: string | null | undefined,
  candidate: string | null | undefined,
): string | null {
  const isDate = (v?: string | null): v is string =>
    !!v && /^\d{4}-\d{2}-\d{2}/.test(v);
  if (!isDate(candidate)) return isDate(current) ? current : (current ?? null);
  if (!isDate(current)) return candidate;
  return candidate.slice(0, 10) > current.slice(0, 10) ? candidate : current;
}

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Latest spraying / fumigasi / fogging date of each stack row, from the synced SPK
 * Perawatan lines with the same product and lot. Returned in the order of `rows`.
 */
export async function findLatestTreatmentDates(
  prisma: PrismaLike,
  warehouseId: number,
  rows: { productName?: string | null; sku?: string | null; lot?: string | null }[],
): Promise<TreatmentDates[]> {
  const empty = (): TreatmentDates => ({
    spraying: null,
    fumigasi: null,
    fogging: null,
  });

  const lots = Array.from(
    new Set(
      rows
        .map((r) => r.lot?.trim())
        .filter((l): l is string => !!l && l !== '-'),
    ),
  );
  if (!lots.length) return rows.map(empty);

  const lines = await prisma.spkPerawatanLine.findMany({
    where: {
      lotName: { in: lots, mode: 'insensitive' },
      spkPerawatan: {
        warehouseId,
        date: { not: null },
        treatmentTypes: { isEmpty: false },
        OR: [{ state: null }, { state: { notIn: IGNORED_SPK_STATES } }],
      },
    },
    select: {
      productName: true,
      lotName: true,
      spkPerawatan: { select: { date: true, treatmentTypes: true } },
    },
  });

  const linesByLot = new Map<string, typeof lines>();
  for (const line of lines) {
    const key = normalizeText(line.lotName);
    linesByLot.set(key, [...(linesByLot.get(key) ?? []), line]);
  }

  return rows.map((row) => {
    const result = empty();
    for (const line of linesByLot.get(normalizeText(row.lot)) ?? []) {
      if (
        !spkProductMatches(line.productName, {
          name: row.productName,
          sku: row.sku,
        })
      ) {
        continue;
      }
      const day = toMakassarDate(line.spkPerawatan.date!);
      for (const type of line.spkPerawatan.treatmentTypes) {
        const field = SPK_TREATMENT_FIELD[type as SpkTreatmentType];
        if (field) result[field] = laterDate(result[field], day);
      }
    }
    return result;
  });
}
