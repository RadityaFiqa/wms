import useSWR from 'swr';
import { api } from '@/lib/axios';
import { API_ROUTES } from '@/lib/api-routes';

export function useWarehouse() {
  const { data, error, isLoading, mutate } = useSWR(
    API_ROUTES.warehouse.list,
    (url) => api.get(url).then((res) => res.data)
  );

  return {
    warehouses: data,
    error,
    isLoading,
    mutate,
  };
}
