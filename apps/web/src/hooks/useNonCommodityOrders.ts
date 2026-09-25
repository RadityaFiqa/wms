import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import { useAuthStore } from "@/store/auth";
import type { PurchaseOrderQueryInput } from "@bulog-wms/schema";

export function useNonCommodityOrders(query?: PurchaseOrderQueryInput) {
  const { activeWarehouse } = useAuthStore();

  const queryParams = new URLSearchParams();
  if (query?.page) queryParams.set("page", String(query.page));
  if (query?.limit) queryParams.set("limit", String(query.limit));
  if (query?.search) queryParams.set("search", query.search);
  if (query?.state) queryParams.set("state", query.state);
  if (query?.startDate) queryParams.set("startDate", query.startDate);
  if (query?.endDate) queryParams.set("endDate", query.endDate);
  if (query?.sortBy) queryParams.set("sortBy", query.sortBy);
  if (query?.sortOrder) queryParams.set("sortOrder", query.sortOrder);
  if (activeWarehouse?.uuid) queryParams.set("warehouseUuid", activeWarehouse.uuid);

  const queryString = queryParams.toString();
  const swrKey = activeWarehouse
    ? `${API_ROUTES.finance.purchaseOrders.list}${queryString ? `?${queryString}` : ""}`
    : null;

  const { data, error, isLoading } = useSWR(swrKey, (url) =>
    api.get(url).then((res) => res.data),
  );

  const refresh = useCallback(() => {
    mutate(
      (key) =>
        typeof key === "string" &&
        key.startsWith(API_ROUTES.finance.purchaseOrders.list),
    );
  }, []);

  const forceSync = useCallback(async () => {
    const res = await api.post(API_ROUTES.finance.purchaseOrders.forceSync);
    refresh();
    return res.data;
  }, [refresh]);

  return {
    ordersData: data,
    isLoading,
    error,
    refresh,
    forceSync,
  };
}

export function useNonCommodityOrderDetail(uuid: string | null) {
  const swrKey = uuid ? API_ROUTES.finance.purchaseOrders.detail(uuid) : null;

  const { data, error, isLoading } = useSWR(swrKey, (url) =>
    api.get(url).then((res) => res.data),
  );

  const refresh = useCallback(() => {
    if (swrKey) {
      mutate(swrKey);
    }
  }, [swrKey]);

  return {
    orderDetail: data,
    isLoading,
    error,
    refresh,
  };
}

export function useNonCommoditySyncStatus() {
  const { activeWarehouse } = useAuthStore();
  const swrKey = activeWarehouse
    ? `${API_ROUTES.finance.purchaseOrders.syncStatus}?warehouseUuid=${activeWarehouse.uuid}`
    : null;

  const { data, error, isLoading } = useSWR(
    swrKey,
    (url) => api.get(url).then((res) => res.data),
    {
      refreshInterval: 5000, // poll every 5s during sync
    },
  );

  const refreshStatus = useCallback(() => {
    if (swrKey) {
      mutate(swrKey);
    }
  }, [swrKey]);

  return {
    syncStatus: data,
    isLoading,
    error,
    refreshStatus,
  };
}
