import { useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/axios';
import { API_ROUTES } from '@/lib/api-routes';

export function useStockOpname(query?: {
  search?: string;
  status?: string;
  createdById?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const queryString = query
    ? `?page=${query.page || 1}&limit=${query.limit || 10}&search=${query.search || ''}&status=${query.status || ''}&createdById=${query.createdById || ''}&startDate=${query.startDate || ''}&endDate=${query.endDate || ''}`
    : '';

  const { data, error, isLoading } = useSWR(
    query ? `${API_ROUTES.stockOpname.list}${queryString}` : null,
    (url) => api.get(url).then((res) => res.data)
  );

  const refresh = useCallback(() => {
    mutate((key) => typeof key === 'string' && key.startsWith(API_ROUTES.stockOpname.list));
  }, []);

  const createStockOpname = useCallback(async (notes?: string) => {
    const res = await api.post(API_ROUTES.stockOpname.create, { notes });
    refresh();
    return res.data;
  }, [refresh]);

  return {
    stockOpnameData: data,
    error,
    isLoading,
    refresh,
    createStockOpname,
  };
}

export function useStockOpnameDetail(uuid?: string) {
  const { data, error, isLoading, mutate: refreshDetail } = useSWR(
    uuid ? API_ROUTES.stockOpname.detail(uuid) : null,
    (url) => api.get(url).then((res) => res.data)
  );

  const updateDraft = useCallback(async (body: {
    notes?: string;
    stacks?: Array<{ uuid: string; actualQty: number | null }>;
    attachmentPaths?: string[];
  }) => {
    if (!uuid) return;
    const res = await api.put(API_ROUTES.stockOpname.update(uuid), body);
    refreshDetail();
    // Also trigger refresh for the list SWR cache
    mutate((key) => typeof key === 'string' && key.startsWith(API_ROUTES.stockOpname.list));
    return res.data;
  }, [uuid, refreshDetail]);

  const submitOpname = useCallback(async () => {
    if (!uuid) return;
    const res = await api.post(API_ROUTES.stockOpname.submit(uuid));
    refreshDetail();
    mutate((key) => typeof key === 'string' && key.startsWith(API_ROUTES.stockOpname.list));
    return res.data;
  }, [uuid, refreshDetail]);

  const downloadCountingSheet = useCallback(async () => {
    if (!uuid) return;
    const res = await api.get(API_ROUTES.stockOpname.countingSheet(uuid), {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `counting-sheet-${uuid}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, [uuid]);

  const downloadResultPdf = useCallback(async () => {
    if (!uuid) return;
    const res = await api.get(API_ROUTES.stockOpname.exportPdf(uuid), {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `stock-opname-report-${uuid}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, [uuid]);

  return {
    detailData: data,
    error,
    isLoading,
    refresh: refreshDetail,
    updateDraft,
    submitOpname,
    downloadCountingSheet,
    downloadResultPdf,
  };
}
