import { useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/axios';
import { API_ROUTES } from '@/lib/api-routes';

export function useInventory(query?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  const queryString = query
    ? `?page=${query.page || 1}&limit=${query.limit || 10}&search=${query.search || ''}`
    : '';

  const { data, error, isLoading } = useSWR(
    query ? `${API_ROUTES.inventory.list}${queryString}` : null,
    (url) => api.get(url).then((res) => res.data)
  );

  const refresh = useCallback(() => {
    mutate((key) => typeof key === 'string' && key.startsWith(API_ROUTES.inventory.list));
  }, []);

  const syncInventory = useCallback(async () => {
    const res = await api.post(API_ROUTES.inventory.sync);
    refresh();
    return res.data;
  }, [refresh]);

  const exportPdf = useCallback(async (searchString = '') => {
    const res = await api.get(`${API_ROUTES.inventory.list}/export/pdf?search=${searchString}`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inventory-report-${Date.now()}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, []);

  return {
    inventoryData: data,
    error,
    isLoading,
    refresh,
    syncInventory,
    exportPdf,
  };
}

export function useInventoryDetail(productUuid?: string) {
  const { data, error, isLoading } = useSWR(
    productUuid ? API_ROUTES.inventory.detail(productUuid) : null,
    (url) => api.get(url).then((res) => res.data)
  );

  const refreshDetail = useCallback(() => {
    if (productUuid) {
      mutate(API_ROUTES.inventory.detail(productUuid));
    }
  }, [productUuid]);

  return {
    detailData: data,
    error,
    isLoading,
    refresh: refreshDetail,
  };
}

export function useInventorySyncStatus() {
  const { data, error, isLoading, mutate: refreshStatus } = useSWR(
    `${API_ROUTES.inventory.list}/sync/status`,
    (url) => api.get(url).then((res) => res.data)
  );

  return {
    statusData: data,
    error,
    isLoading,
    refreshStatus,
  };
}

export function useWarehouseLocations() {
  const { data, error, isLoading } = useSWR(
    `${API_ROUTES.inventory.list}/locations`,
    (url) => api.get(url).then((res) => res.data)
  );

  return {
    locations: (data || []) as { id: number; uuid: string; displayName: string }[],
    error,
    isLoading,
  };
}

export function useProducts(query?: { search?: string }) {
  const queryString = query?.search ? `?search=${encodeURIComponent(query.search)}` : '';
  const { data, error, isLoading, mutate } = useSWR(
    `${API_ROUTES.inventory.products}${queryString}`,
    (url) => api.get(url).then((res) => res.data)
  );

  return {
    products: data || [],
    error,
    isLoading,
    mutate,
  };
}
