/**
 * Odoo stock.move.line fields describing where a quantity was actually
 * picked from / put away to (the real stack location & lot).
 */
const MOVE_LINE_SPECIFICATION = {
  id: {},
  picking_id: { fields: { display_name: {} } },
  product_id: { fields: { display_name: {} } },
  location_id: { fields: { display_name: {} } },
  location_dest_id: { fields: { display_name: {} } },
  lot_id: { fields: { display_name: {} } },
  quantity: {},
  date: {},
};

/**
 * Chained moves (e.g. Pick -> Ship, Receipt -> Storage) whose move lines
 * hold the real stack location when the warehouse uses multi-step routes.
 * Nested two levels deep to support up to 3-step routes (Pick -> Pack -> Ship).
 */
const CHAINED_MOVE_SPECIFICATION = {
  id: {},
  state: {},
  move_line_ids: { fields: MOVE_LINE_SPECIFICATION },
};

const CHAINED_MOVES_SPECIFICATION = {
  ...CHAINED_MOVE_SPECIFICATION,
  move_orig_ids: { fields: CHAINED_MOVE_SPECIFICATION },
  move_dest_ids: { fields: CHAINED_MOVE_SPECIFICATION },
};

/**
 * WMS operations (vit.picking for outgoing, putaway for incoming) linked to a
 * stock.picking. Their done moves' lines carry the real stack source/destination.
 */
const WMS_OPERATION_SPECIFICATION = {
  id: {},
  name: {},
  state: {},
  move_ids: {
    fields: {
      id: {},
      state: {},
      product_id: { fields: { display_name: {} } },
      move_line_ids: { fields: MOVE_LINE_SPECIFICATION },
    },
  },
};

/**
 * Extra stock.picking fields that are only kept in the document's rawPayload.
 * Not every Odoo instance has them, so they are dropped when Odoo rejects them.
 * The display_name sub-spec gives { id, display_name } for a many2one and is
 * ignored for a plain field.
 */
const OPTIONAL_PICKING_SPECIFICATION = {
  picking_ref: { fields: { display_name: {} } },
};

/**
 * stock.picking specification without the WMS operation relations and the
 * optional fields, the last fallback when Odoo rejects any of them.
 */
const STOCK_PICKING_CORE_SPECIFICATION = {
  id: {},
  name: {},
  state: {},
  picking_type_code: {},
  partner_id: { fields: { display_name: {} } },
  purchase_id: { fields: { display_name: {} } },
  origin: {},
  ref_fax: {},
  location_id: { fields: { display_name: {} } },
  location_dest_id: { fields: { display_name: {} } },
  scheduled_date: {},
  date_done: {},
  driver: {},
  plat_number: {},
  move_ids_without_package: {
    fields: {
      id: {},
      product_id: { fields: { display_name: {} } },
      product_uom: { fields: { display_name: {} } },
      analytic_account_id: { fields: { display_name: {} } },
      quantity: {},
      product_qty: {},
      sh_sec_qty: {},
      sh_sec_uom_id: { fields: { display_name: {} } },
      move_line_ids: { fields: MOVE_LINE_SPECIFICATION },
      move_orig_ids: { fields: CHAINED_MOVES_SPECIFICATION },
      move_dest_ids: { fields: CHAINED_MOVES_SPECIFICATION },
    },
  },
};

/**
 * stock.picking specification without the WMS operation relations, used as a
 * fallback when the Odoo instance rejects picking_ids / putaway_ids.
 */
export const STOCK_PICKING_BASE_SPECIFICATION = {
  ...STOCK_PICKING_CORE_SPECIFICATION,
  ...OPTIONAL_PICKING_SPECIFICATION,
};

/**
 * Shared web_read / web_search_read specification for stock.picking.
 */
export const STOCK_PICKING_SPECIFICATION = {
  ...STOCK_PICKING_BASE_SPECIFICATION,
  picking_ids: { fields: WMS_OPERATION_SPECIFICATION },
  putaway_ids: { fields: WMS_OPERATION_SPECIFICATION },
};

const isInvalidFieldError = (err: any): boolean =>
  /Invalid field|KeyError/i.test(err?.message || '');

/**
 * Reads stock.picking with the full specification, retrying without the WMS
 * operation fields and then without the optional fields when Odoo rejects one
 * of them, so a field mismatch never blocks the whole document sync.
 */
export async function readStockPickingWithFallback<T>(
  read: (specification: Record<string, any>) => Promise<T>,
  onFallback?: (err: any) => void,
): Promise<T> {
  const attempts = [
    STOCK_PICKING_SPECIFICATION,
    STOCK_PICKING_BASE_SPECIFICATION,
    STOCK_PICKING_CORE_SPECIFICATION,
  ];
  for (let i = 0; ; i++) {
    try {
      return await read(attempts[i]);
    } catch (err: any) {
      if (!isInvalidFieldError(err) || i === attempts.length - 1) throw err;
      onFallback?.(err);
    }
  }
}
