import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import { useAuthStore } from "@/store/auth";
import type { BuruhQueryInput, BuruhResponse } from "@bulog-wms/schema";

export interface BuruhListResponse {
  data: BuruhResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BuruhFormValues {
  name: string;
  nik?: string;
  isActive: boolean;
  isMandor: boolean;
  ktpPhoto?: File | null;
  removeKtpPhoto?: boolean;
}

const refreshBuruhList = () =>
  mutate(
    (key) => typeof key === "string" && key.startsWith(API_ROUTES.finance.buruh.list),
  );

const toFormData = (values: Partial<BuruhFormValues>) => {
  const formData = new FormData();
  if (values.name !== undefined) formData.append("name", values.name);
  if (values.nik !== undefined) formData.append("nik", values.nik);
  if (values.isActive !== undefined) formData.append("isActive", String(values.isActive));
  if (values.isMandor !== undefined) formData.append("isMandor", String(values.isMandor));
  if (values.removeKtpPhoto) formData.append("removeKtpPhoto", "true");
  if (values.ktpPhoto) formData.append("ktpPhoto", values.ktpPhoto);
  return formData;
};

export function useBuruhs(query?: BuruhQueryInput) {
  const { activeWarehouse } = useAuthStore();

  const queryParams = new URLSearchParams();
  if (query?.page) queryParams.set("page", String(query.page));
  if (query?.limit) queryParams.set("limit", String(query.limit));
  if (query?.search) queryParams.set("search", query.search);
  if (query?.isActive) queryParams.set("isActive", query.isActive);
  if (query?.isMandor) queryParams.set("isMandor", query.isMandor);
  if (activeWarehouse?.uuid) queryParams.set("warehouseUuid", activeWarehouse.uuid);

  const queryString = queryParams.toString();
  const swrKey = activeWarehouse
    ? `${API_ROUTES.finance.buruh.list}${queryString ? `?${queryString}` : ""}`
    : null;

  const { data, error, isLoading } = useSWR<BuruhListResponse>(swrKey, (url: string) =>
    api.get(url).then((res) => res.data),
  );

  const refresh = useCallback(() => {
    refreshBuruhList();
  }, []);

  return {
    buruhsData: data,
    isLoading,
    error,
    refresh,
  };
}

export async function createBuruh(values: BuruhFormValues) {
  const res = await api.post(API_ROUTES.finance.buruh.create, toFormData(values), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  refreshBuruhList();
  return res.data as BuruhResponse;
}

export async function updateBuruh(uuid: string, values: Partial<BuruhFormValues>) {
  const res = await api.put(API_ROUTES.finance.buruh.update(uuid), toFormData(values), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  refreshBuruhList();
  return res.data as BuruhResponse;
}

export async function deleteBuruh(uuid: string) {
  const res = await api.delete(API_ROUTES.finance.buruh.delete(uuid));
  refreshBuruhList();
  return res.data;
}
