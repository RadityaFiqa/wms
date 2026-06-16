import { useCallback } from "react";
import useSWR from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";

export function useReports(query?: {
  startDate: string;
  endDate: string;
  productId?: string;
  category?: string;
}) {
  const hasDates = query?.startDate && query?.endDate;
  const queryString = hasDates
    ? `?startDate=${query.startDate}&endDate=${query.endDate}&productId=${query.productId || ""}&category=${query.category || ""}`
    : "";

  const { data, error, isLoading, mutate } = useSWR(
    hasDates ? `${API_ROUTES.reports.stockMovement}${queryString}` : null,
    (url) => api.get(url).then((res) => res.data),
  );

  const exportPdf = useCallback(async () => {
    if (!hasDates) return;
    const res = await api.get(`${API_ROUTES.reports.exportPdf}${queryString}`, {
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `stock-movement-report-${Date.now()}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, [hasDates, queryString]);

  const exportCsv = useCallback(async () => {
    if (!hasDates) return;
    const res = await api.get(`${API_ROUTES.reports.exportCsv}${queryString}`, {
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `stock-movement-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }, [hasDates, queryString]);

  return {
    reportData: data || [],
    error,
    isLoading,
    refresh: mutate,
    exportPdf,
    exportCsv,
  };
}

export function useReportDetail(date?: string, productUuid?: string) {
  const queryString =
    date && productUuid ? `?date=${date}&productUuid=${productUuid}` : "";

  const { data, error, isLoading } = useSWR(
    date && productUuid ? `${API_ROUTES.reports.detail}${queryString}` : null,
    (url) => api.get(url).then((res) => res.data),
  );

  return {
    detailData: data,
    error,
    isLoading,
  };
}
