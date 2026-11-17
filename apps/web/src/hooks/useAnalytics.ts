import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import { useAuthStore } from "@/store/auth";
import type {
  CreateStockFolderInput,
  FlowTrendQueryInput,
  FlowTrendResponse,
  InboundFolder,
  MoveStockFolderItemInput,
  RenameStockFolderInput,
  StockInboundResponse,
} from "@bulog-wms/schema";

const toQueryString = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

// The warehouse uuid is only part of the cache key (the API takes the warehouse from
// the request header), so switching warehouse refetches instead of showing stale data
const fetcher = <T,>([url]: [string, string | undefined]) =>
  api.get<T>(url).then((res) => res.data);

export function useFlowTrend(query: FlowTrendQueryInput) {
  const warehouseUuid = useAuthStore((s) => s.activeWarehouse?.uuid);
  const url = `${API_ROUTES.reports.analytics.flowTrend}${toQueryString({
    startDate: query.startDate,
    endDate: query.endDate,
    granularity: query.granularity,
    category: query.category,
    account: query.account,
    productUuid: query.productUuid,
  })}`;

  const { data, error, isLoading } = useSWR<FlowTrendResponse>(
    [url, warehouseUuid],
    fetcher,
    { keepPreviousData: true },
  );

  return { flowTrend: data, error, isLoading };
}

export function useStockInbound() {
  const warehouseUuid = useAuthStore((s) => s.activeWarehouse?.uuid);
  const { data, error, isLoading } = useSWR<StockInboundResponse>(
    [API_ROUTES.reports.analytics.stockInbound, warehouseUuid],
    fetcher,
    { keepPreviousData: true },
  );

  return { stockInbound: data, error, isLoading };
}

// Folders live in the stock inbound response, so every change refetches it
const refreshStockInbound = () =>
  mutate((key) => Array.isArray(key) && key[0] === API_ROUTES.reports.analytics.stockInbound);

export async function createStockFolder(input: CreateStockFolderInput) {
  const res = await api.post<InboundFolder>(API_ROUTES.reports.analytics.stockFolders, input);
  await refreshStockInbound();
  return res.data;
}

export async function renameStockFolder(uuid: string, input: RenameStockFolderInput) {
  const res = await api.patch<InboundFolder>(API_ROUTES.reports.analytics.stockFolderDetail(uuid), input);
  await refreshStockInbound();
  return res.data;
}

export async function deleteStockFolder(uuid: string) {
  await api.delete(API_ROUTES.reports.analytics.stockFolderDetail(uuid));
  await refreshStockInbound();
}

/** Moves a whole sender (lotName null) or one lot into a folder, or out (folderUuid null) */
export async function moveStockFolderItem(input: MoveStockFolderItemInput) {
  await api.put(API_ROUTES.reports.analytics.stockFolderItems, input);
  await refreshStockInbound();
}
