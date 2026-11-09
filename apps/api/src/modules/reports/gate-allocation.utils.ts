const EPSILON = 1e-6;

export type GateProductInput = {
  id: number;
  quantity: number;
  locationId: number | null;
};

export type StackInput = {
  locationId: number;
  qty: number;
  referenceDocument: string;
};

export type GateAllocation = {
  locationId: number;
  qty: number;
  referenceDocument: string | null;
};

export type GateMatchResult = {
  /** Locations each gate product is booked on, keyed by gate product id */
  byProductId: Map<number, GateAllocation[]>;
  /** Move line qty per location that no gate product covered (gate total < ERP) */
  uncovered: Map<number, number>;
  /** Gate qty per location beyond the move lines (gate total > ERP) */
  overflow: Map<number, number>;
};

/**
 * Matches the gate products of one done ERP document (same product) to the real stacks
 * recorded in its move lines. Each gate product keeps its own gate location as far as the
 * move lines allow; only the rest moves to the other stacks. Whole quantities stay whole,
 * unlike a proportional split.
 */
export function matchGateProductsToStacks(
  products: GateProductInput[],
  stacks: StackInput[],
): GateMatchResult {
  const remaining = new Map<number, number>();
  const referenceByLocation = new Map<number, string>();
  for (const stack of stacks) {
    remaining.set(
      stack.locationId,
      (remaining.get(stack.locationId) || 0) + stack.qty,
    );
    referenceByLocation.set(stack.locationId, stack.referenceDocument);
  }

  const sortedProducts = [...products].sort((a, b) => a.id - b.id);
  const need = new Map<number, number>(
    sortedProducts.map((p) => [p.id, p.quantity]),
  );
  const booked = new Map<number, Map<number, number>>(
    sortedProducts.map((p) => [p.id, new Map<number, number>()]),
  );
  const overflow = new Map<number, number>();

  const book = (productId: number, locationId: number, qty: number) => {
    const perLocation = booked.get(productId)!;
    perLocation.set(locationId, (perLocation.get(locationId) || 0) + qty);
    need.set(productId, (need.get(productId) || 0) - qty);
  };

  // 1. Each gate product first takes from the stack it was recorded on at the gate
  for (const product of sortedProducts) {
    if (product.locationId === null) continue;
    const available = remaining.get(product.locationId) || 0;
    const take = Math.min(need.get(product.id) || 0, available);
    if (take > EPSILON) {
      book(product.id, product.locationId, take);
      remaining.set(product.locationId, available - take);
    }
  }

  // 2. The rest goes to the other stacks, largest remaining first
  for (const product of sortedProducts) {
    while ((need.get(product.id) || 0) > EPSILON) {
      const next = Array.from(remaining.entries())
        .filter(([, qty]) => qty > EPSILON)
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      if (!next) break;
      const [locationId, available] = next;
      const take = Math.min(need.get(product.id) || 0, available);
      book(product.id, locationId, take);
      remaining.set(locationId, available - take);
    }
  }

  // 3. Gate qty beyond the move lines stays on its gate stack (or the biggest stack)
  const fallbackLocationId = [...stacks].sort(
    (a, b) => b.qty - a.qty || a.locationId - b.locationId,
  )[0]?.locationId;
  for (const product of sortedProducts) {
    const rest = need.get(product.id) || 0;
    if (rest <= EPSILON) continue;
    const locationId =
      product.locationId !== null && remaining.has(product.locationId)
        ? product.locationId
        : fallbackLocationId;
    if (locationId === undefined) continue;
    book(product.id, locationId, rest);
    overflow.set(locationId, (overflow.get(locationId) || 0) + rest);
  }

  const byProductId = new Map<number, GateAllocation[]>();
  for (const product of sortedProducts) {
    byProductId.set(
      product.id,
      Array.from(booked.get(product.id)!.entries()).map(
        ([locationId, qty]) => ({
          locationId,
          qty,
          referenceDocument: referenceByLocation.get(locationId) ?? null,
        }),
      ),
    );
  }

  const uncovered = new Map<number, number>();
  for (const [locationId, qty] of remaining.entries()) {
    if (qty > EPSILON) uncovered.set(locationId, qty);
  }

  return { byProductId, uncovered, overflow };
}
