import { useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/axios';
import { API_ROUTES } from '@/lib/api-routes';
import { useAuthStore } from '@/store/auth';

export function useOdooAccount() {
  const { activeWarehouse } = useAuthStore();

  // Dynamic SWR key ensures re-fetching when activeWarehouse changes
  const swrKey = activeWarehouse
    ? `${API_ROUTES.odoo.list}?warehouseUuid=${activeWarehouse.uuid}`
    : null;

  const { data, error, isLoading } = useSWR(
    swrKey,
    (url) => api.get(url).then((res) => res.data)
  );

  const refresh = useCallback(() => {
    mutate((key) => typeof key === 'string' && key.startsWith(API_ROUTES.odoo.list));
  }, []);

  const createConfig = useCallback(async (payload: any) => {
    const res = await api.post(API_ROUTES.odoo.create, payload);
    refresh();
    return res.data;
  }, [refresh]);

  const updateConfig = useCallback(async (uuid: string, payload: any) => {
    const res = await api.put(API_ROUTES.odoo.update(uuid), payload);
    refresh();
    return res.data;
  }, [refresh]);

  const deleteConfig = useCallback(async (uuid: string) => {
    const res = await api.delete(API_ROUTES.odoo.delete(uuid));
    refresh();
    return res.data;
  }, [refresh]);

  const toggleStatus = useCallback(async (uuid: string, action: 'activate' | 'deactivate') => {
    const res = await api.post(API_ROUTES.odoo.status(uuid, action));
    refresh();
    return res.data;
  }, [refresh]);

  const testConnection = useCallback(async (uuid: string) => {
    const res = await api.post(API_ROUTES.odoo.testConnection(uuid));
    return res.data;
  }, []);

  const testConnectionRaw = useCallback(async (payload: any) => {
    const res = await api.post(API_ROUTES.odoo.testConnectionRaw, payload);
    return res.data;
  }, []);

  const refreshSession = useCallback(async (uuid: string) => {
    const res = await api.post(API_ROUTES.odoo.refresh(uuid));
    refresh();
    return res.data;
  }, [refresh]);

  return {
    config: data,
    error,
    isLoading,
    refresh,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleStatus,
    testConnection,
    testConnectionRaw,
    refreshSession,
  };
}
