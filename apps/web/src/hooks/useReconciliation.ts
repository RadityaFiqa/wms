import useSWR from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";

export function useReconciliation(params?: { productId?: string; locationId?: string }) {
  const query = new URLSearchParams();
  if (params?.productId) query.append("productId", params.productId);
  if (params?.locationId) query.append("locationId", params.locationId);
  const queryString = query.toString() ? `?${query.toString()}` : "";

  const { data, error, isLoading, mutate } = useSWR(
    `${API_ROUTES.reconciliation.list}${queryString}`,
    (url) => api.get(url).then((res) => res.data),
  );

  return {
    reconciliationData: data || [],
    error,
    isLoading,
    refresh: mutate,
  };
}

export function useReconciliationDetail(productUuid?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    productUuid ? API_ROUTES.reconciliation.detail(productUuid) : null,
    (url) => api.get(url).then((res) => res.data),
  );

  return {
    detailData: data,
    error,
    isLoading,
    refresh: mutate,
  };
}
