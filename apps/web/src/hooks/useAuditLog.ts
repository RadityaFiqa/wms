import useSWR from 'swr';
import { api } from '@/lib/axios';
import { API_ROUTES } from '@/lib/api-routes';

export function useAuditLog(query?: {
  search?: string;
  action?: string;
  page?: number;
  limit?: number;
}) {
  const queryString = query
    ? `?page=${query.page || 1}&limit=${query.limit || 10}&search=${query.search || ''}&action=${query.action || ''}`
    : '';

  const { data, error, isLoading, mutate } = useSWR(
    `${API_ROUTES.auditLog.list}${queryString}`,
    (url) => api.get(url).then((res) => res.data)
  );

  return {
    auditLogsData: data,
    error,
    isLoading,
    refresh: mutate,
  };
}
