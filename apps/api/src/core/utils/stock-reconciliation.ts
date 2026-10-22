import { Prisma } from '@prisma/client';

/**
 * A gate line is pending (not yet reflected in ERP stock) while the document it is
 * counted against is not done: its own document, or — for unallocated lines
 * (documentReferenceId = null) — the gate operation's primary document.
 * Lines counted against a done document are handled through that document's adjustment,
 * so every line is counted exactly once even when one operation spans several documents.
 */
export const PENDING_GATE_PRODUCT_WHERE = {
  OR: [
    {
      documentReferenceId: null,
      gateOperation: {
        OR: [
          { documentReferenceId: null },
          { documentReference: { state: { not: 'done' } } },
        ],
      },
    },
    { documentReference: { state: { not: 'done' } } },
  ],
} satisfies Prisma.GateOperationProductWhereInput;

function distributeAdjustmentHelper(
  adjustment: number,
  items: { id: number; qty: number }[],
): Map<number, number> {
  const result = new Map<number, number>();
  if (items.length === 0) return result;

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  if (totalQty === 0) {
    let remaining = adjustment;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (i === items.length - 1) {
        result.set(item.id, remaining);
      } else {
        const share = Math.round(adjustment / items.length);
        result.set(item.id, share);
        remaining -= share;
      }
    }
    return result;
  }

  let distributedSum = 0;
  const shares = items.map((item) => {
    const exactShare = (adjustment * item.qty) / totalQty;
    const roundedShare = Math.round(exactShare);
    distributedSum += roundedShare;
    return { id: item.id, qty: item.qty, roundedShare, exactShare };
  });

  const difference = adjustment - distributedSum;
  if (difference !== 0) {
    shares.sort((a, b) => {
      const remA = a.exactShare - a.roundedShare;
      const remB = b.exactShare - b.roundedShare;
      return difference > 0 ? remB - remA : remA - remB;
    });

    const step = difference > 0 ? 1 : -1;
    for (let i = 0; i < Math.abs(difference); i++) {
      const index = i % shares.length;
      shares[index].roundedShare += step;
    }
  }

  for (const s of shares) {
    result.set(s.id, s.roundedShare);
  }

  return result;
}

/**
 * Calculates the reconciled stock for all quants of a product in a warehouse,
 * following the logic used in the daily stock movement report.
 */
export async function getReconciledStockForQuants(
  tx: any,
  warehouseId: number,
  productId: number,
  excludeGateOperationId?: number,
): Promise<Map<number, number>> {
  // 1. Get all quants for this product in the warehouse
  const quants = await tx.quant.findMany({
    where: {
      inventoryId: productId,
      location: {
        warehouseId,
      },
    },
  });

  // 2. Fetch completed Document References for the warehouse containing this product to compute adjustments
  const completedDocs = await tx.documentReference.findMany({
    where: {
      warehouseId,
      state: 'done',
      items: {
        some: {
          inventoryId: productId,
        },
      },
      OR: [
        {
          gateOperations: {
            some: {
              status: {
                notIn: ['CANCELED', 'REJECTED'],
              },
            },
          },
        },
        {
          operationProducts: {
            some: {
              inventoryId: productId,
              gateOperation: { status: { notIn: ['CANCELED', 'REJECTED'] } },
            },
          },
        },
      ],
    },
    include: {
      items: {
        where: {
          inventoryId: productId,
        },
      },
      // Lines allocated to this document
      operationProducts: {
        where: {
          inventoryId: productId,
          gateOperation: { status: { notIn: ['CANCELED', 'REJECTED'] } },
        },
      },
      // Unallocated lines of operations whose primary document is this one
      gateOperations: {
        where: {
          status: {
            notIn: ['CANCELED', 'REJECTED'],
          },
        },
        include: {
          products: {
            where: {
              inventoryId: productId,
              documentReferenceId: null,
            },
          },
        },
      },
    },
  });

  const cumulativeQuantAdjustments = new Map<number, number>();

  for (const doc of completedDocs) {
    const pickingTypeCode = doc.pickingTypeCode;
    if (pickingTypeCode !== 'incoming' && pickingTypeCode !== 'outgoing') {
      continue;
    }

    // Group gate operations products by quantId
    let sumGateQty = 0;
    const docGateQuantsMap = new Map<number, number>();

    const docGateProducts = [
      ...doc.operationProducts,
      ...doc.gateOperations.flatMap((op: any) => op.products),
    ];
    for (const gp of docGateProducts) {
      sumGateQty += gp.quantity;
      if (gp.quantId) {
        docGateQuantsMap.set(
          gp.quantId,
          (docGateQuantsMap.get(gp.quantId) || 0) + gp.quantity,
        );
      }
    }

    const item = doc.items[0];
    if (!item) continue;

    const erpQty = item.productQty;

    if (sumGateQty !== erpQty) {
      let adjustment = 0;
      if (pickingTypeCode === 'incoming') {
        adjustment = sumGateQty - erpQty;
      } else if (pickingTypeCode === 'outgoing') {
        adjustment = erpQty - sumGateQty;
      }

      if (adjustment !== 0 && docGateQuantsMap.size > 0) {
        const quantList = Array.from(docGateQuantsMap.entries()).map(
          ([id, qty]) => ({ id, qty }),
        );
        const distributed = distributeAdjustmentHelper(adjustment, quantList);
        for (const [qId, qAdj] of distributed.entries()) {
          cumulativeQuantAdjustments.set(
            qId,
            (cumulativeQuantAdjustments.get(qId) || 0) + qAdj,
          );
        }
      }
    }
  }

  // 3. Fetch all active pending/unreconciled Gate Operations for this product in this warehouse
  const activePendingOps = await tx.gateOperation.findMany({
    where: {
      warehouseId,
      status: { in: ['PENDING', 'VERIFIED'] },
      id: excludeGateOperationId ? { not: excludeGateOperationId } : undefined,
      products: {
        some: {
          inventoryId: productId,
          ...PENDING_GATE_PRODUCT_WHERE,
        },
      },
    },
    include: {
      products: {
        where: {
          inventoryId: productId,
          ...PENDING_GATE_PRODUCT_WHERE,
        },
      },
    },
  });

  const pendingInMap = new Map<number, number>();
  const pendingOutMap = new Map<number, number>();

  for (const op of activePendingOps) {
    const isOut = op.cardType === 'OUT';
    for (const gp of op.products) {
      if (!gp.quantId) continue;
      if (isOut) {
        pendingOutMap.set(
          gp.quantId,
          (pendingOutMap.get(gp.quantId) || 0) + gp.quantity,
        );
      } else {
        pendingInMap.set(
          gp.quantId,
          (pendingInMap.get(gp.quantId) || 0) + gp.quantity,
        );
      }
    }
  }

  // 4. Compute reconciled stock for each quant
  const reconciledStockMap = new Map<number, number>();

  for (const quant of quants) {
    const qId = quant.id;
    const erpStock = quant.quantity;
    const pendingIn = pendingInMap.get(qId) || 0;
    const pendingOut = pendingOutMap.get(qId) || 0;
    const adj = cumulativeQuantAdjustments.get(qId) || 0;

    const reconciledStock = erpStock + pendingIn - pendingOut + adj;
    reconciledStockMap.set(qId, reconciledStock);
  }

  return reconciledStockMap;
}
