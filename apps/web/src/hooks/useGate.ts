import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import { useAuthStore } from "@/store/auth";

export function useGate() {
  const { activeWarehouse } = useAuthStore();

  const refreshList = useCallback(() => {
    mutate(
      (key) =>
        typeof key === "string" &&
        key.startsWith(API_ROUTES.gateOperations.list),
    );
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await api.post(API_ROUTES.storage.upload, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  }, []);

  const createGateOperation = useCallback(
    async (payload: any) => {
      const res = await api.post(API_ROUTES.gateOperations.create, payload);
      refreshList();
      return res.data;
    },
    [refreshList],
  );

  const verifyGateOperation = useCallback(
    async (operationUuid: string, payload: any) => {
      const res = await api.post(
        API_ROUTES.gateVerifications.verify(operationUuid),
        payload,
      );
      refreshList();
      // Invalidate details page cache as well
      mutate(API_ROUTES.gateOperations.detail(operationUuid));
      return res.data;
    },
    [refreshList],
  );

  const cancelGateVerification = useCallback(
    async (operationUuid: string) => {
      const res = await api.post(
        API_ROUTES.gateVerifications.cancel(operationUuid),
      );
      refreshList();
      mutate(API_ROUTES.gateOperations.detail(operationUuid));
      return res.data;
    },
    [refreshList],
  );

  const confirmGateVerification = useCallback(
    async (operationUuid: string) => {
      const res = await api.post(
        API_ROUTES.gateVerifications.confirm(operationUuid),
      );
      refreshList();
      mutate(API_ROUTES.gateOperations.detail(operationUuid));
      return res.data;
    },
    [refreshList],
  );

  const updateNotesAttachments = useCallback(
    async (operationUuid: string, payload: { notes?: string; attachmentPaths?: string[] }) => {
      const res = await api.put(
        API_ROUTES.gateVerifications.notesAttachments(operationUuid),
        payload,
      );
      refreshList();
      mutate(API_ROUTES.gateOperations.detail(operationUuid));
      return res.data;
    },
    [refreshList],
  );


  const addCargoItem = useCallback(
    async (
      operationUuid: string,
      payload: {
        productId: number;
        quantity: number;
        notes?: string;
        quantId?: number | null;
        locationId?: number | null;
      },
    ) => {
      const res = await api.post(
        `/gate-operations/${operationUuid}/cargo`,
        payload,
      );
      refreshList();
      mutate(API_ROUTES.gateOperations.detail(operationUuid));
      return res.data;
    },
    [refreshList],
  );

  const deleteCargoItem = useCallback(
    async (cargoItemUuid: string, operationUuid: string) => {
      const res = await api.delete(`/gate-operations/cargo/${cargoItemUuid}`);
      refreshList();
      mutate(API_ROUTES.gateOperations.detail(operationUuid));
      return res.data;
    },
    [refreshList],
  );

  const updateCargoItem = useCallback(
    async (
      cargoItemUuid: string,
      operationUuid: string,
      payload: {
        quantId?: number | null;
        locationId?: number | null;
        quantity?: number;
      },
    ) => {
      const res = await api.put(
        `/gate-operations/cargo/${cargoItemUuid}`,
        payload,
      );
      refreshList();
      mutate(API_ROUTES.gateOperations.detail(operationUuid));
      return res.data;
    },
    [refreshList],
  );


  return {
    uploadFile,
    createGateOperation,
    verifyGateOperation,
    cancelGateVerification,
    confirmGateVerification,
    updateNotesAttachments,
    addCargoItem,
    deleteCargoItem,
    updateCargoItem,
    refreshList,
  };
}


export function useGateOperations(
  query: {
    search?: string;
    cardType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
  } = {},
) {
  const { activeWarehouse } = useAuthStore();
  const searchParams = new URLSearchParams();

  if (query.search) searchParams.append("search", query.search);
  if (query.cardType) searchParams.append("cardType", query.cardType);
  if (query.status) searchParams.append("status", query.status);
  if (query.startDate) searchParams.append("startDate", query.startDate);
  if (query.endDate) searchParams.append("endDate", query.endDate);
  if (query.page) searchParams.append("page", String(query.page));
  if (query.limit) searchParams.append("limit", String(query.limit));
  if (query.sortOrder) searchParams.append("sortOrder", query.sortOrder);

  // Dynamic SWR key ensures auto-re-fetching when activeWarehouse or query filters change
  const swrKey = activeWarehouse
    ? `${API_ROUTES.gateOperations.list}?warehouseUuid=${activeWarehouse.uuid}&${searchParams.toString()}`
    : null;

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useSWR(
    swrKey,
    // Extract query string and map to the exact route
    () => {
      const url = `${API_ROUTES.gateOperations.list}?${searchParams.toString()}`;
      return api.get(url).then((res) => res.data);
    },
  );

  return {
    data,
    error,
    isLoading,
    refresh,
  };
}

export function useGateOperationDetail(uuid: string | null) {
  const swrKey = uuid ? API_ROUTES.gateOperations.detail(uuid) : null;

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useSWR(swrKey, (url) => api.get(url).then((res) => res.data));

  return {
    gateOperation: data,
    error,
    isLoading,
    refresh,
  };
}

export function useGateVerificationHistory(operationUuid: string | null) {
  const swrKey = operationUuid
    ? API_ROUTES.gateVerifications.history(operationUuid)
    : null;

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useSWR(swrKey, (url) => api.get(url).then((res) => res.data));

  return {
    data: data as any[] | undefined,
    error,
    isLoading,
    refresh,
  };
}

