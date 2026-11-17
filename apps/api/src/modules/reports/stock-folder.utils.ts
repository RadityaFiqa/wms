import type {
  InboundFolder,
  InboundGroup,
  InboundSender,
  InboundStack,
} from '@bulog-wms/schema';
import { round3 } from '@/modules/reports/analytics.utils';

export const NOT_RECORDED_SENDER = 'Tidak tercatat';

/** Key of a placement: the whole sender has lotName "" */
export const placementKey = (senderName: string, lotName: string | null) =>
  `${senderName}|${lotName ?? ''}`;

/**
 * Folder of a lot: its own placement when it has one (null = kept out of the sender's
 * folder), else the folder of its sender, else none.
 */
export function resolveFolderId(
  placements: Map<string, number | null>,
  senderName: string,
  lotName: string | null,
): number | null {
  if (lotName) {
    const own = placements.get(placementKey(senderName, lotName));
    if (own !== undefined) return own;
  }
  return placements.get(placementKey(senderName, null)) ?? null;
}

/** Quantity and distinct gates of the rows not yet administered */
function pendingOf(stacks: InboundStack[]) {
  const gates = new Set<string>();
  let displayQty = 0;
  for (const st of stacks) {
    for (const lot of st.lots) {
      if (!lot.pendingGate) continue;
      gates.add(lot.pendingGate.gateOperationUuid);
      displayQty += lot.displayQty;
    }
  }
  return {
    pendingDisplayQty: round3(displayQty),
    pendingGateCount: gates.size,
  };
}

const byQtyDesc = <T extends { displayQty: number }>(a: T, b: T) =>
  b.displayQty - a.displayQty;

// Unrecorded origin always last
const compareSenders = (a: InboundSender, b: InboundSender) =>
  Number(a.name === NOT_RECORDED_SENDER) -
    Number(b.name === NOT_RECORDED_SENDER) || byQtyDesc(a, b);

/**
 * Splits the senders of a product over its folders: manual folders in their order
 * (empty ones included, so lots can be dropped in), then the rest under folder null.
 */
export function groupSendersByFolder(
  senders: InboundSender[],
  folders: (InboundFolder & { id: number })[],
  placements: Map<string, number | null>,
  productDisplayQty: number,
): InboundGroup[] {
  const known = new Set(folders.map((f) => f.id));
  const buckets = new Map<number | null, Map<string, InboundSender>>();
  for (const f of folders) buckets.set(f.id, new Map());
  buckets.set(null, new Map());

  for (const sender of senders) {
    for (const stack of sender.stacks) {
      for (const lot of stack.lots) {
        const resolved = resolveFolderId(placements, sender.name, lot.lotName);
        const folderId =
          resolved !== null && known.has(resolved) ? resolved : null;
        const bucket = buckets.get(folderId)!;

        let target = bucket.get(sender.name);
        if (!target) {
          target = { ...sender, displayQty: 0, stacks: [] };
          bucket.set(sender.name, target);
        }
        let targetStack = target.stacks.find(
          (s) => s.locationUuid === stack.locationUuid,
        );
        if (!targetStack) {
          targetStack = { ...stack, displayQty: 0, lots: [] };
          target.stacks.push(targetStack);
        }
        targetStack.lots.push(lot);
        targetStack.displayQty += lot.displayQty;
        target.displayQty += lot.displayQty;
      }
    }
  }

  const finishStacks = (stacks: InboundStack[]) =>
    stacks
      .map((s) => ({
        ...s,
        displayQty: round3(s.displayQty),
        lots: [...s.lots].sort(byQtyDesc),
      }))
      .sort(byQtyDesc);

  const toGroup = (
    folder: InboundFolder | null,
    bucket: Map<string, InboundSender>,
  ): InboundGroup => {
    const groupSenders = Array.from(bucket.values())
      .map((s) => ({
        ...s,
        displayQty: round3(s.displayQty),
        ...pendingOf(s.stacks),
        stacks: finishStacks(s.stacks),
      }))
      .sort(compareSenders);

    const stackIds = new Set<string>();
    const lotNames = new Set<string>();
    let unnamedLots = 0;
    let displayQty = 0;
    let lastReceivedAt: string | null = null;
    for (const s of groupSenders) {
      displayQty += s.displayQty;
      for (const st of s.stacks) {
        stackIds.add(st.locationUuid);
        for (const lot of st.lots) {
          // Gate lines not yet administered are not lots of their own
          if (!lot.pendingGate) {
            if (lot.lotName) lotNames.add(lot.lotName);
            else unnamedLots += 1;
          }
          const received = [
            ...lot.documents.map((d) => d.dateDone),
            lot.pendingGate?.cardType === 'IN' ? lot.pendingGate.date : null,
          ];
          for (const date of received) {
            if (date && (!lastReceivedAt || date > lastReceivedAt)) {
              lastReceivedAt = date;
            }
          }
        }
      }
    }

    return {
      folder,
      summary: {
        displayQty: round3(displayQty),
        sharePct:
          productDisplayQty > 0
            ? Math.round((displayQty / productDisplayQty) * 1000) / 10
            : 0,
        senderCount: groupSenders.length,
        stackCount: stackIds.size,
        lotCount: lotNames.size + unnamedLots,
        lastReceivedAt,
        ...pendingOf(groupSenders.flatMap((s) => s.stacks)),
      },
      senders: groupSenders,
    };
  };

  return [
    ...folders.map((f) =>
      toGroup({ uuid: f.uuid, name: f.name }, buckets.get(f.id)!),
    ),
    toGroup(null, buckets.get(null)!),
  ];
}
