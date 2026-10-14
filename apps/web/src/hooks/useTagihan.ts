import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import { useAuthStore } from "@/store/auth";
import type {
  TagihanQueryInput,
  CreateTagihanInput,
  UpdateTagihanInput,
  CreateMasterTagihanStatusInput,
} from "@bulog-wms/schema";

export function useTagihans(query?: TagihanQueryInput) {
  const { activeWarehouse } = useAuthStore();

  const queryParams = new URLSearchParams();
  if (query?.page) queryParams.set("page", String(query.page));
  if (query?.limit) queryParams.set("limit", String(query.limit));
  if (query?.search) queryParams.set("search", query.search);
  if (query?.type) queryParams.set("type", query.type);
  if (query?.statusUuid) queryParams.set("statusUuid", query.statusUuid);
  if (query?.startDate) queryParams.set("startDate", query.startDate);
  if (query?.endDate) queryParams.set("endDate", query.endDate);
  if (query?.documentNumber) queryParams.set("documentNumber", query.documentNumber);
  if (query?.relatedDocumentNumber) queryParams.set("relatedDocumentNumber", query.relatedDocumentNumber);
  if (query?.productName) queryParams.set("productName", query.productName);
  if (query?.sortBy) queryParams.set("sortBy", query.sortBy);
  if (query?.sortOrder) queryParams.set("sortOrder", query.sortOrder);
  if (activeWarehouse?.uuid) queryParams.set("warehouseUuid", activeWarehouse.uuid);

  const queryString = queryParams.toString();
  const swrKey = activeWarehouse
    ? `${API_ROUTES.finance.tagihan.list}${queryString ? `?${queryString}` : ""}`
    : null;

  const { data, error, isLoading } = useSWR(swrKey, (url) =>
    api.get(url).then((res) => res.data),
  );

  const refresh = useCallback(() => {
    mutate(
      (key) =>
        typeof key === "string" && key.startsWith(API_ROUTES.finance.tagihan.list),
    );
  }, []);

  return {
    tagihansData: data,
    isLoading,
    error,
    refresh,
  };
}

export function useTagihanDetail(uuid: string | null) {
  const swrKey = uuid ? API_ROUTES.finance.tagihan.detail(uuid) : null;

  const { data, error, isLoading } = useSWR(swrKey, (url) =>
    api.get(url).then((res) => res.data),
  );

  const refresh = useCallback(() => {
    if (swrKey) {
      mutate(swrKey);
    }
  }, [swrKey]);

  return {
    tagihan: data,
    isLoading,
    error,
    refresh,
  };
}

export function useMasterTagihanStatuses() {
  const swrKey = API_ROUTES.finance.tagihan.statuses;

  const { data, error, isLoading } = useSWR(swrKey, (url) =>
    api.get(url).then((res) => res.data),
  );

  const refresh = useCallback(() => {
    mutate(swrKey);
  }, [swrKey]);

  return {
    statuses: (data || []) as Array<{
      uuid: string;
      name: string;
      description?: string | null;
      color?: string | null;
      isDefault: boolean;
    }>,
    isLoading,
    error,
    refresh,
  };
}

export function useErpCandidates(query?: {
  tagihanType?: string;
  search?: string;
  pickingTypeCode?: string;
  productName?: string;
  refFax?: string;
  month?: string;
  page?: number;
  limit?: number;
}) {
  const { activeWarehouse } = useAuthStore();

  const queryParams = new URLSearchParams();
  if (query?.tagihanType) queryParams.set("tagihanType", query.tagihanType);
  if (query?.search) queryParams.set("search", query.search);
  if (query?.pickingTypeCode) queryParams.set("pickingTypeCode", query.pickingTypeCode);
  if (query?.productName) queryParams.set("productName", query.productName);
  if (query?.refFax) queryParams.set("refFax", query.refFax);
  if (query?.month) queryParams.set("month", query.month);
  if (query?.page) queryParams.set("page", String(query.page));
  if (query?.limit) queryParams.set("limit", String(query.limit));
  if (activeWarehouse?.uuid) queryParams.set("warehouseUuid", activeWarehouse.uuid);

  const queryString = queryParams.toString();
  const swrKey = activeWarehouse
    ? `${API_ROUTES.finance.tagihan.erpCandidates}${queryString ? `?${queryString}` : ""}`
    : null;

  const { data, error, isLoading } = useSWR(swrKey, (url) =>
    api.get(url).then((res) => res.data),
  );

  return {
    candidatesData: data,
    isLoading,
    error,
  };
}

export async function createTagihan(payload: CreateTagihanInput) {
  const res = await api.post(API_ROUTES.finance.tagihan.create, payload);
  mutate(
    (key) =>
      typeof key === "string" && key.startsWith(API_ROUTES.finance.tagihan.list),
  );
  return res.data;
}

export async function updateTagihan(uuid: string, payload: UpdateTagihanInput) {
  const res = await api.put(API_ROUTES.finance.tagihan.update(uuid), payload);
  mutate(
    (key) =>
      typeof key === "string" && key.startsWith(API_ROUTES.finance.tagihan.list),
  );
  mutate(API_ROUTES.finance.tagihan.detail(uuid));
  return res.data;
}

export async function deleteTagihan(uuid: string) {
  const res = await api.delete(API_ROUTES.finance.tagihan.delete(uuid));
  mutate(
    (key) =>
      typeof key === "string" && key.startsWith(API_ROUTES.finance.tagihan.list),
  );
  return res.data;
}

export async function createMasterTagihanStatus(
  payload: CreateMasterTagihanStatusInput,
) {
  const res = await api.post(API_ROUTES.finance.tagihan.createStatus, payload);
  mutate(API_ROUTES.finance.tagihan.statuses);
  return res.data;
}

export async function uploadTagihanFile(uuid: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post(API_ROUTES.finance.tagihan.uploadFile(uuid), formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  mutate(API_ROUTES.finance.tagihan.detail(uuid));
  return res.data;
}

export async function deleteTagihanFile(uuid: string, fileUuid: string) {
  const res = await api.delete(API_ROUTES.finance.tagihan.deleteFile(uuid, fileUuid));
  mutate(API_ROUTES.finance.tagihan.detail(uuid));
  return res.data;
}
