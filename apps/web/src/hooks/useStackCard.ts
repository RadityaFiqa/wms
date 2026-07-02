import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import { ImportStackCardInput, UpdateStackCardInput } from "@bulog-wms/schema";

export function useStackCards(query?: {
  search?: string;
  page?: number;
  limit?: number;
  locationName?: string;
  snapshotDate?: string;
  isPublished?: string;
}) {
  const searchParams = new URLSearchParams();
  if (query?.page) searchParams.append("page", String(query.page));
  if (query?.limit) searchParams.append("limit", String(query.limit));
  if (query?.search) searchParams.append("search", query.search);
  if (query?.locationName) searchParams.append("locationName", query.locationName);
  if (query?.snapshotDate) searchParams.append("snapshotDate", query.snapshotDate);
  if (query?.isPublished) searchParams.append("isPublished", query.isPublished);

  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";

  const { data, error, isLoading } = useSWR(
    `${API_ROUTES.stackCards.list}${queryString}`,
    (url: string) => api.get(url).then((res) => res.data),
  );

  const refresh = useCallback(() => {
    mutate(
      (key) =>
        typeof key === "string" && key.startsWith(API_ROUTES.stackCards.list),
    );
  }, []);

  return {
    stackCardData: data,
    error,
    isLoading,
    refresh,
  };
}

export function useStackCardHistory() {
  const { data, error, isLoading } = useSWR(
    API_ROUTES.stackCards.history,
    (url: string) => api.get(url).then((res) => res.data),
  );

  const refreshHistory = useCallback(() => {
    mutate(API_ROUTES.stackCards.history);
  }, []);

  return {
    historyData: data || [],
    error,
    isLoading,
    refreshHistory,
  };
}

export function useStackCardDates(onlyPublished = false) {
  const { data, error, isLoading } = useSWR(
    `${API_ROUTES.stackCards.snapshotDates}?onlyPublished=${onlyPublished}`,
    (url: string) => api.get(url).then((res) => res.data),
  );

  const refreshDates = useCallback(() => {
    mutate(`${API_ROUTES.stackCards.snapshotDates}?onlyPublished=${onlyPublished}`);
  }, [onlyPublished]);

  return {
    dates: (data || []) as string[],
    error,
    isLoading,
    refreshDates,
  };
}

export function useStackCardLocations(onlyPublished = false) {
  const { data, error, isLoading } = useSWR(
    `${API_ROUTES.stackCards.locations}?onlyPublished=${onlyPublished}`,
    (url: string) => api.get(url).then((res) => res.data),
  );

  const refreshLocations = useCallback(() => {
    mutate(`${API_ROUTES.stackCards.locations}?onlyPublished=${onlyPublished}`);
  }, [onlyPublished]);

  return {
    locations: (data || []) as string[],
    error,
    isLoading,
    refreshLocations,
  };
}

export function useStackCardActions() {
  const importStackCards = useCallback(async (data: ImportStackCardInput) => {
    const res = await api.post(API_ROUTES.stackCards.import, data);
    // Refresh all stack card queries
    mutate((key) => typeof key === "string" && key.includes("/stack-cards"));
    return res.data;
  }, []);

  const updateStackCard = useCallback(
    async (uuid: string, data: UpdateStackCardInput) => {
      const res = await api.put(API_ROUTES.stackCards.update(uuid), data);
      mutate((key) => typeof key === "string" && key.includes("/stack-cards"));
      return res.data;
    },
    [],
  );

  const deleteStackCard = useCallback(async (uuid: string) => {
    const res = await api.delete(API_ROUTES.stackCards.delete(uuid));
    mutate((key) => typeof key === "string" && key.includes("/stack-cards"));
    return res.data;
  }, []);

  const bulkDeleteStackCards = useCallback(async (uuids: string[]) => {
    const res = await api.delete(API_ROUTES.stackCards.bulkDelete, {
      data: { uuids },
    });
    mutate((key) => typeof key === "string" && key.includes("/stack-cards"));
    return res.data;
  }, []);

  const bulkPublishStackCards = useCallback(
    async (uuids: string[], isPublished: boolean) => {
      const res = await api.put(API_ROUTES.stackCards.bulkPublish, {
        uuids,
        isPublished,
      });
      mutate((key) => typeof key === "string" && key.includes("/stack-cards"));
      return res.data;
    },
    [],
  );

  const publishSnapshotDate = useCallback(
    async (snapshotDate: string, isPublished: boolean) => {
      const res = await api.put(API_ROUTES.stackCards.publishSnapshot, {
        snapshotDate,
        isPublished,
      });
      mutate((key) => typeof key === "string" && key.includes("/stack-cards"));
      return res.data;
    },
    [],
  );

  return {
    importStackCards,
    updateStackCard,
    deleteStackCard,
    bulkDeleteStackCards,
    bulkPublishStackCards,
    publishSnapshotDate,
  };
}

export function usePublicWarehouses() {
  const { data, error, isLoading } = useSWR(
    API_ROUTES.stackCards.publicWarehouses,
    (url: string) => api.get(url).then((res) => res.data),
  );

  return {
    warehouses: (data || []) as { uuid: string; name: string; code: string }[],
    error,
    isLoading,
  };
}

export function usePublicStackCards(
  warehouseUuid?: string,
  query?: {
    search?: string;
    page?: number;
    limit?: number;
    locationName?: string;
    snapshotDate?: string;
  },
) {
  const searchParams = new URLSearchParams();
  if (warehouseUuid) searchParams.append("warehouseUuid", warehouseUuid);
  if (query?.page) searchParams.append("page", String(query.page));
  if (query?.limit) searchParams.append("limit", String(query.limit));
  if (query?.search) searchParams.append("search", query.search);
  if (query?.locationName) searchParams.append("locationName", query.locationName);
  if (query?.snapshotDate) searchParams.append("snapshotDate", query.snapshotDate);

  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const hasKey = !!warehouseUuid || !!query?.locationName;

  const { data, error, isLoading } = useSWR(
    hasKey ? `${API_ROUTES.stackCards.publicList}${queryString}` : null,
    (url: string) => api.get(url).then((res) => res.data),
  );

  return {
    stackCardData: data,
    error,
    isLoading,
  };
}

export function usePublicStackCardDates(warehouseUuid?: string, locationName?: string) {
  const searchParams = new URLSearchParams();
  if (warehouseUuid) searchParams.append("warehouseUuid", warehouseUuid);
  if (locationName) searchParams.append("locationName", locationName);

  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const hasKey = !!warehouseUuid || !!locationName;

  const { data, error, isLoading } = useSWR(
    hasKey ? `${API_ROUTES.stackCards.publicSnapshotDates}${queryString}` : null,
    (url: string) => api.get(url).then((res) => res.data),
  );

  return {
    dates: (data || []) as string[],
    error,
    isLoading,
  };
}

export function usePublicStackCardLocations(warehouseUuid?: string, locationName?: string) {
  const searchParams = new URLSearchParams();
  if (warehouseUuid) searchParams.append("warehouseUuid", warehouseUuid);
  if (locationName) searchParams.append("locationName", locationName);

  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const hasKey = !!warehouseUuid || !!locationName;

  const { data, error, isLoading } = useSWR(
    hasKey ? `${API_ROUTES.stackCards.publicLocations}${queryString}` : null,
    (url: string) => api.get(url).then((res) => res.data),
  );

  return {
    locations: (data || []) as string[],
    error,
    isLoading,
  };
}

