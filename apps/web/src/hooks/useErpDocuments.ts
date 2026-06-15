import { useCallback, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/axios';
import { API_ROUTES } from '@/lib/api-routes';
import { useAuthStore } from '@/store/auth';

export function useErpDocuments(query?: {
  search?: string;
  page?: number;
  limit?: number;
  type?: 'IN' | 'OUT' | '';
  state?: string;
  startDate?: string;
  endDate?: string;
  refFax?: string;
}) {
  const { activeWarehouse } = useAuthStore();
  const searchParams = new URLSearchParams();

  if (query?.search) searchParams.append('search', query.search);
  if (query?.page) searchParams.append('page', String(query.page));
  if (query?.limit) searchParams.append('limit', String(query.limit));
  if (query?.type) searchParams.append('type', query.type);
  if (query?.state) searchParams.append('state', query.state);
  if (query?.startDate) searchParams.append('startDate', query.startDate);
  if (query?.endDate) searchParams.append('endDate', query.endDate);
  if (query?.refFax) searchParams.append('refFax', query.refFax);

  const queryString = searchParams.toString();
  const swrKey = activeWarehouse
    ? `${API_ROUTES.erpDocumentReferences.list}?warehouseUuid=${activeWarehouse.uuid}&${queryString}`
    : null;

  const { data, error, isLoading, mutate: refresh } = useSWR(
    swrKey,
    () => {
      const url = `${API_ROUTES.erpDocumentReferences.list}?${queryString}`;
      return api.get(url).then((res) => res.data);
    }
  );

  const syncErpDocuments = useCallback(async () => {
    const res = await api.post(API_ROUTES.erpDocumentReferences.sync);
    mutate((key) => typeof key === 'string' && key.startsWith(API_ROUTES.erpDocumentReferences.list));
    return res.data;
  }, []);

  const forceSyncErpDocument = useCallback(async (uuid: string) => {
    const res = await api.post(API_ROUTES.erpDocumentReferences.forceSync(uuid));
    mutate((key) => typeof key === 'string' && key.startsWith(API_ROUTES.erpDocumentReferences.list));
    return res.data;
  }, []);

  return {
    documentsData: data,
    error,
    isLoading,
    refresh,
    syncErpDocuments,
    forceSyncErpDocument,
  };
}

export function useErpDocumentDetail(uuid: string | null) {
  const swrKey = uuid ? API_ROUTES.erpDocumentReferences.detail(uuid) : null;

  const { data, error, isLoading, mutate: refreshDetail } = useSWR(
    swrKey,
    (url) => api.get(url).then((res) => res.data)
  );

  const forceSyncDetail = useCallback(async () => {
    if (!uuid) return;
    const res = await api.post(API_ROUTES.erpDocumentReferences.forceSync(uuid));
    refreshDetail();
    return res.data;
  }, [uuid, refreshDetail]);

  return {
    documentDetail: data,
    error,
    isLoading,
    refresh: refreshDetail,
    forceSyncDetail,
  };
}

export interface ErpSyncStatusResponse {
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  processedDocuments: number;
  totalDocuments: number;
  startedAt: string | null;
  lastSyncAt: string | null;
}

export function useErpSyncStatus() {
  const { activeWarehouse } = useAuthStore();

  const swrKey = activeWarehouse
    ? `${API_ROUTES.erpDocumentReferences.syncStatus}?warehouseUuid=${activeWarehouse.uuid}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<ErpSyncStatusResponse>(
    swrKey,
    () => api.get(API_ROUTES.erpDocumentReferences.syncStatus).then((res) => res.data)
  );

  useEffect(() => {
    if (!data) return;
    if (data.status === 'RUNNING' || data.status === 'PENDING') {
      const interval = setInterval(() => {
        mutate();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [data?.status, mutate]);

  return {
    syncStatus: data,
    isLoading,
    error,
    refreshStatus: mutate,
  };
}

export function useErpPartners() {
  const { activeWarehouse } = useAuthStore();

  const swrKey = activeWarehouse
    ? `${API_ROUTES.erpDocumentReferences.partners}?warehouseUuid=${activeWarehouse.uuid}`
    : null;

  const { data, error, isLoading, mutate: refresh } = useSWR<string[]>(
    swrKey,
    () => api.get(API_ROUTES.erpDocumentReferences.partners).then((res) => res.data)
  );

  return {
    partners: data || [],
    error,
    isLoading,
    refresh,
  };
}
