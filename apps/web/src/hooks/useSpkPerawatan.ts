import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import { useAuthStore } from "@/store/auth";
import type {
  SpkPerawatanExportQueryInput,
  SpkPerawatanListResponse,
  SpkPerawatanQueryInput,
  SpkPerawatanSyncResult,
} from "@bulog-wms/schema";

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
};

// The warehouse uuid is only part of the cache key (the API takes the warehouse from
// the request header), so switching warehouse refetches instead of showing stale data
const fetcher = <T,>([url]: [string, string | undefined]) =>
  api.get<T>(url).then((res) => res.data);

const isSpkKey = (key: unknown) =>
  Array.isArray(key) &&
  typeof key[0] === "string" &&
  key[0].startsWith(API_ROUTES.spkPerawatan.list);

/** SPK Perawatan (usulan) synced from Odoo, with the kartu tumpukan holding each line's product + lot */
export function useSpkPerawatan(query: SpkPerawatanQueryInput) {
  const warehouseUuid = useAuthStore((s) => s.activeWarehouse?.uuid);
  const url = `${API_ROUTES.spkPerawatan.list}${toQueryString({ ...query })}`;

  const { data, error, isLoading } = useSWR<SpkPerawatanListResponse>(
    [url, warehouseUuid],
    fetcher,
    { keepPreviousData: true },
  );

  return { spkData: data, error, isLoading };
}

export function useSpkPerawatanActions() {
  const syncSpk = useCallback(async () => {
    const res = await api.post<SpkPerawatanSyncResult>(API_ROUTES.spkPerawatan.sync);
    // Treatment dates on the kartu tumpukan come from the synced SPK
    await mutate(isSpkKey);
    await mutate((key) => typeof key === "string" && key.includes("/stack-cards"));
    return res.data;
  }, []);

  const exportSpkXlsx = useCallback(async (query: SpkPerawatanExportQueryInput) => {
    const res = await api.get(
      `${API_ROUTES.spkPerawatan.exportXlsx}${toQueryString({ ...query })}`,
      { responseType: "blob" },
    );
    const blobUrl = window.URL.createObjectURL(
      new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const link = document.createElement("a");
    link.href = blobUrl;
    link.setAttribute("download", `spk-perawatan-${date}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  }, []);

  return { syncSpk, exportSpkXlsx };
}
