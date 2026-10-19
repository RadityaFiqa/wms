import { useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import type {
  GenerateSuratPermohonanInput,
  GenerateTandaTerimaInput,
  TagihanDocumentPrefill,
  TagihanDocumentPurpose,
  TagihanDocumentTemplateOption,
  TagihanGeneratedDocumentItem,
} from "@bulog-wms/schema";

const routes = API_ROUTES.finance.tagihan.documents;
const fetcher = (url: string) => api.get(url).then((res) => res.data);

const refreshHistory = (uuid: string) =>
  mutate((key) => typeof key === "string" && key.startsWith(routes.history(uuid)));

export function useTagihanDocumentTemplates(
  uuid: string | null,
  purpose: TagihanDocumentPurpose,
  enabled = true,
) {
  const key = uuid && enabled ? `${routes.templates(uuid)}?purpose=${purpose}` : null;
  const { data, error, isLoading } = useSWR<TagihanDocumentTemplateOption[]>(key, fetcher);
  return { templates: data ?? [], isLoading, error };
}

export function useTagihanDocumentPrefill(
  uuid: string | null,
  purpose: TagihanDocumentPurpose,
  options: { templateUuid?: string; enabled?: boolean } = {},
) {
  const { templateUuid, enabled = true } = options;
  const params = new URLSearchParams({ purpose });
  if (templateUuid) params.set("templateUuid", templateUuid);
  const key = uuid && enabled ? `${routes.prefill(uuid)}?${params.toString()}` : null;
  // Prefill reflects the Tagihan at open time; don't refetch on focus mid-edit
  const { data, error, isLoading } = useSWR<TagihanDocumentPrefill>(key, fetcher, {
    revalidateOnFocus: false,
  });
  return { prefill: data, isLoading, error };
}

/**
 * Generation history; polls while anything is processing and refreshes the
 * Tagihan detail (Supporting Files) when a run finishes.
 */
export function useTagihanGeneratedDocuments(uuid: string | null) {
  const key = uuid ? routes.history(uuid) : null;
  const { data, error, isLoading } = useSWR<TagihanGeneratedDocumentItem[]>(key, fetcher, {
    refreshInterval: (latest) =>
      latest?.some((d) => d.status === "PROCESSING") ? 3000 : 0,
  });

  const processingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!uuid || !data) return;
    const nowProcessing = new Set(data.filter((d) => d.status === "PROCESSING").map((d) => d.uuid));
    const finished = Array.from(processingRef.current).some((id) => !nowProcessing.has(id));
    processingRef.current = nowProcessing;
    if (finished) {
      mutate(API_ROUTES.finance.tagihan.detail(uuid));
    }
  }, [data, uuid]);

  return { documents: data ?? [], isLoading, error };
}

export async function generateSuratPermohonan(uuid: string, payload: GenerateSuratPermohonanInput) {
  const res = await api.post(routes.generateSuratPermohonan(uuid), payload);
  refreshHistory(uuid);
  return res.data as { uuid: string; status: string };
}

export async function generateTandaTerima(uuid: string, payload: GenerateTandaTerimaInput) {
  const res = await api.post(routes.generateTandaTerima(uuid), payload);
  refreshHistory(uuid);
  return res.data as { uuid: string; status: string };
}

export async function getTagihanDocumentUrl(
  uuid: string,
  docUuid: string,
  kind: "preview" | "pdf" | "docx",
) {
  const url = kind === "preview" ? routes.preview(uuid, docUuid) : routes.download(uuid, docUuid, kind);
  const res = await api.get(url);
  return res.data.url as string;
}
