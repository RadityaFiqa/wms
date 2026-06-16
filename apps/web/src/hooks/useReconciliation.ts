import useSWR from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";

export function useReconciliation() {
  const { data, error, isLoading, mutate } = useSWR(
    API_ROUTES.reconciliation.list,
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
