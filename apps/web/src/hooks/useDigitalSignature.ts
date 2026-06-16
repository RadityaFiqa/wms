import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";

export function useDigitalSignature() {
  // 1. Categories
  const {
    data: categories,
    error: categoriesError,
    isLoading: categoriesLoading,
  } = useSWR(API_ROUTES.digitalSignature.categories.list, (url) =>
    api.get(url).then((res) => res.data),
  );

  // 2. Templates
  const {
    data: templates,
    error: templatesError,
    isLoading: templatesLoading,
  } = useSWR(API_ROUTES.digitalSignature.templates.list, (url) =>
    api.get(url).then((res) => res.data),
  );

  // 3. Manual Documents
  const {
    data: manualDocuments,
    error: manualDocsError,
    isLoading: manualDocsLoading,
  } = useSWR(API_ROUTES.digitalSignature.manualDocuments.list, (url) =>
    api.get(url).then((res) => res.data),
  );

  const createManualDoc = useCallback(async (payload: any) => {
    const res = await api.post(
      API_ROUTES.digitalSignature.manualDocuments.create,
      payload,
    );
    mutate(API_ROUTES.digitalSignature.manualDocuments.list);
    return res.data;
  }, []);

  const deleteManualDoc = useCallback(async (uuid: string) => {
    const res = await api.delete(
      API_ROUTES.digitalSignature.manualDocuments.delete(uuid),
    );
    mutate(API_ROUTES.digitalSignature.manualDocuments.list);
    return res.data;
  }, []);

  // 4. Signed Documents (we don't SWR cache this list globally as it usually uses query filters, we can load it with custom search params inside SWR or fetch directly)
  const getSignedDocuments = async (params: {
    search?: string;
    categoryId?: number;
    sourceType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const query = new URLSearchParams();
    if (params.search) query.append("search", params.search);
    if (params.categoryId)
      query.append("categoryId", String(params.categoryId));
    if (params.sourceType) query.append("sourceType", params.sourceType);
    if (params.status) query.append("status", params.status);
    if (params.startDate) query.append("startDate", params.startDate);
    if (params.endDate) query.append("endDate", params.endDate);

    const res = await api.get(
      `${API_ROUTES.digitalSignature.signedDocuments.list}?${query.toString()}`,
    );
    return res.data;
  };

  const getSignedDocumentDetail = async (uuid: string) => {
    const res = await api.get(
      API_ROUTES.digitalSignature.signedDocuments.detail(uuid),
    );
    return res.data;
  };

  const signErpDocument = useCallback(async (uuid: string, payload: any) => {
    const res = await api.post(
      API_ROUTES.digitalSignature.signedDocuments.signErp(uuid),
      payload,
    );
    mutate(API_ROUTES.digitalSignature.signedDocuments.list);
    return res.data;
  }, []);

  const signManualDocument = useCallback(async (uuid: string, payload: any) => {
    const res = await api.post(
      API_ROUTES.digitalSignature.signedDocuments.signManual(uuid),
      payload,
    );
    mutate(API_ROUTES.digitalSignature.manualDocuments.list);
    mutate(API_ROUTES.digitalSignature.signedDocuments.list);
    return res.data;
  }, []);

  // 5. User Signatures
  const {
    data: userSignatures,
    error: userSignaturesError,
    isLoading: userSignaturesLoading,
  } = useSWR("/user-signatures", (url) => api.get(url).then((res) => res.data));

  const { data: activeSignature, mutate: mutateActiveSig } = useSWR(
    "/user-signatures/active",
    (url) => api.get(url).then((res) => res.data),
  );

  const uploadSignature = useCallback(
    async (fileBlob: Blob | File, filename = "signature.png") => {
      const formData = new FormData();
      formData.append("file", fileBlob, filename);
      const res = await api.post("/user-signatures", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      mutate("/user-signatures");
      mutateActiveSig();
      return res.data;
    },
    [mutateActiveSig],
  );

  const activateSignature = useCallback(
    async (id: number) => {
      const res = await api.post(`/user-signatures/${id}/activate`);
      mutate("/user-signatures");
      mutateActiveSig();
      return res.data;
    },
    [mutateActiveSig],
  );

  const deleteSignature = useCallback(
    async (id: number) => {
      const res = await api.delete(`/user-signatures/${id}`);
      mutate("/user-signatures");
      mutateActiveSig();
      return res.data;
    },
    [mutateActiveSig],
  );

  return {
    // Categories
    categories,
    categoriesError,
    categoriesLoading,

    // Templates
    templates,
    templatesError,
    templatesLoading,

    // Manual Docs
    manualDocuments,
    manualDocsError,
    manualDocsLoading,
    createManualDoc,
    deleteManualDoc,

    // Signed Docs & Signing
    getSignedDocuments,
    getSignedDocumentDetail,
    signErpDocument,
    signManualDocument,

    // User Signatures
    userSignatures,
    userSignaturesError,
    userSignaturesLoading,
    activeSignature,
    uploadSignature,
    activateSignature,
    deleteSignature,
  };
}
