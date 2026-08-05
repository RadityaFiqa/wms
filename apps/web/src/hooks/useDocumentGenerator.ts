import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";

export function useDocumentGenerator() {
  // 1. Categories (reused from digitalSignature)
  const {
    data: categories,
    error: categoriesError,
    isLoading: categoriesLoading,
  } = useSWR(API_ROUTES.digitalSignature.categories.list, (url) =>
    api.get(url).then((res) => res.data),
  );

  // 2. Templates List SWR
  const getTemplates = useCallback(
    async (params: {
      page?: number;
      limit?: number;
      search?: string;
      categoryId?: string;
      active?: boolean;
    }) => {
      const query = new URLSearchParams();
      if (params.page) query.append("page", String(params.page));
      if (params.limit) query.append("limit", String(params.limit));
      if (params.search) query.append("search", params.search);
      if (params.categoryId) query.append("categoryId", params.categoryId);
      if (params.active !== undefined) query.append("active", String(params.active));

      const res = await api.get(
        `${API_ROUTES.documentGenerator.templates.list}?${query.toString()}`,
      );
      return res.data;
    },
    [],
  );

  const getTemplateDetail = async (uuid: string) => {
    const res = await api.get(API_ROUTES.documentGenerator.templates.detail(uuid));
    return res.data;
  };

  const createTemplate = useCallback(async (formData: FormData) => {
    const res = await api.post(
      API_ROUTES.documentGenerator.templates.create,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    mutate((key) => typeof key === "string" && key.startsWith(API_ROUTES.documentGenerator.templates.list));
    return res.data;
  }, []);

  const updateTemplate = useCallback(async (uuid: string, payload: any) => {
    const res = await api.put(
      API_ROUTES.documentGenerator.templates.update(uuid),
      payload,
    );
    mutate((key) => typeof key === "string" && key.startsWith(API_ROUTES.documentGenerator.templates.list));
    return res.data;
  }, []);

  const createNewTemplateVersion = useCallback(
    async (uuid: string, formData: FormData) => {
      const res = await api.post(
        API_ROUTES.documentGenerator.templates.version(uuid),
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      mutate((key) => typeof key === "string" && key.startsWith(API_ROUTES.documentGenerator.templates.list));
      return res.data;
    },
    [],
  );

  const deleteTemplate = useCallback(async (uuid: string) => {
    const res = await api.delete(
      API_ROUTES.documentGenerator.templates.delete(uuid),
    );
    mutate((key) => typeof key === "string" && key.startsWith(API_ROUTES.documentGenerator.templates.list));
    return res.data;
  }, []);

  // 3. Assembly API
  const getAssembly = async (uuid: string) => {
    const res = await api.get(
      API_ROUTES.documentGenerator.templates.assembly(uuid),
    );
    return res.data;
  };

  const updateAssembly = useCallback(async (uuid: string, payload: any) => {
    const res = await api.put(
      API_ROUTES.documentGenerator.templates.assembly(uuid),
      payload,
    );
    return res.data;
  }, []);

  const getPlaceholders = async (uuid: string) => {
    const res = await api.get(
      API_ROUTES.documentGenerator.templates.placeholders(uuid),
    );
    return res.data;
  };

  const updatePlaceholders = useCallback(async (uuid: string, payload: any) => {
    const res = await api.put(
      API_ROUTES.documentGenerator.templates.placeholders(uuid),
      payload,
    );
    return res.data;
  }, []);

  // 4. Generation & History API
  const generateDocument = useCallback(async (payload: any) => {
    const res = await api.post(
      API_ROUTES.documentGenerator.generate,
      payload,
    );
    mutate((key) => typeof key === "string" && key.startsWith(API_ROUTES.documentGenerator.generated.list));
    return res.data;
  }, []);

  const getGeneratedHistory = useCallback(
    async (params: {
      page?: number;
      limit?: number;
      search?: string;
      templateId?: string;
      categoryId?: string;
      status?: string;
      generatedBy?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      const query = new URLSearchParams();
      if (params.page) query.append("page", String(params.page));
      if (params.limit) query.append("limit", String(params.limit));
      if (params.search) query.append("search", params.search);
      if (params.templateId) query.append("templateId", params.templateId);
      if (params.categoryId) query.append("categoryId", params.categoryId);
      if (params.status) query.append("status", params.status);
      if (params.generatedBy) query.append("generatedBy", params.generatedBy);
      if (params.startDate) query.append("startDate", params.startDate);
      if (params.endDate) query.append("endDate", params.endDate);

      const res = await api.get(
        `${API_ROUTES.documentGenerator.generated.list}?${query.toString()}`,
      );
      return res.data;
    },
    [],
  );

  const getGeneratedDetail = async (uuid: string) => {
    const res = await api.get(
      API_ROUTES.documentGenerator.generated.detail(uuid),
    );
    return res.data;
  };

  const getPreviewUrl = async (uuid: string) => {
    const res = await api.get(
      API_ROUTES.documentGenerator.generated.preview(uuid),
    );
    return res.data.url;
  };

  const getDownloadDocxUrl = async (uuid: string) => {
    const res = await api.get(
      API_ROUTES.documentGenerator.generated.downloadDocx(uuid),
    );
    return res.data.url;
  };

  const getDownloadPdfUrl = async (uuid: string) => {
    const res = await api.get(
      API_ROUTES.documentGenerator.generated.downloadPdf(uuid),
    );
    return res.data.url;
  };

  const deleteGeneratedDocument = useCallback(async (uuid: string) => {
    const res = await api.delete(
      API_ROUTES.documentGenerator.generated.delete(uuid),
    );
    mutate((key) => typeof key === "string" && key.startsWith(API_ROUTES.documentGenerator.generated.list));
    return res.data;
  }, []);

  return {
    categories,
    categoriesError,
    categoriesLoading,
    getTemplates,
    getTemplateDetail,
    createTemplate,
    updateTemplate,
    createNewTemplateVersion,
    deleteTemplate,
    getAssembly,
    updateAssembly,
    getPlaceholders,
    updatePlaceholders,
    generateDocument,
    getGeneratedHistory,
    getGeneratedDetail,
    getPreviewUrl,
    getDownloadDocxUrl,
    getDownloadPdfUrl,
    deleteGeneratedDocument,
  };
}
