import { useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/axios';
import { API_ROUTES } from '@/lib/api-routes';

export function useWarehouse(query?: { search?: string; page?: number; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (query?.search) searchParams.append('search', query.search);
  if (query?.page) searchParams.append('page', String(query.page));
  if (query?.limit) searchParams.append('limit', String(query.limit));

  const queryString = searchParams.toString();
  const swrKey = queryString ? `${API_ROUTES.warehouse.list}?${queryString}` : API_ROUTES.warehouse.list;

  const { data, error, isLoading, mutate: refresh } = useSWR(
    swrKey,
    (url) => api.get(url).then((res) => res.data)
  );

  const createWarehouse = useCallback(async (payload: any) => {
    const res = await api.post(API_ROUTES.warehouse.create, payload);
    mutate((key) => typeof key === 'string' && key.startsWith(API_ROUTES.warehouse.list));
    return res.data;
  }, []);

  const updateWarehouse = useCallback(async (uuid: string, payload: any) => {
    const res = await api.put(API_ROUTES.warehouse.update(uuid), payload);
    mutate((key) => typeof key === 'string' && key.startsWith(API_ROUTES.warehouse.list));
    return res.data;
  }, []);

  const deleteWarehouse = useCallback(async (uuid: string) => {
    const res = await api.delete(API_ROUTES.warehouse.delete(uuid));
    mutate((key) => typeof key === 'string' && key.startsWith(API_ROUTES.warehouse.list));
    return res.data;
  }, []);

  return {
    warehousesData: data,
    warehouses: data?.data || data,
    error,
    isLoading,
    refresh,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
  };
}
