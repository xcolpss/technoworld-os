import Dexie, { type Table } from "dexie";

export interface LocalCatalogItem {
  id: string;
  business_id: string;
  item_type: "PRODUCT" | "SERVICE";
  sku: string;
  name: string;
  category_name: string;
  sale_price_paisa: number;
  cost_price_paisa: number;
  stock_qty: number;
  track_inventory: boolean;
  is_active: boolean;
  updated_at: string;
}

export interface LocalQueuedTransaction {
  local_id?: number;
  client_tx_id: string;
  idempotency_key: string;
  business_id: string;
  terminal_code: string;
  entity_type: "SALE" | "EXPENSE" | "SHIFT_EVENT";
  payload_json: string;
  status: "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
  retry_count: number;
  last_error?: string;
  created_at: string;
}

export class TechnoWorldLocalDB extends Dexie {
  catalog!: Table<LocalCatalogItem, string>;
  syncQueue!: Table<LocalQueuedTransaction, number>;

  constructor() {
    super("technoworld_os_local_v1");
    this.version(1).stores({
      catalog: "id, business_id, item_type, sku, name, is_active",
      syncQueue: "++local_id, client_tx_id, idempotency_key, business_id, status, created_at",
    });
  }
}

export const localDb = new TechnoWorldLocalDB();