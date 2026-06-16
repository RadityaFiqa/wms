import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";

export function useRole() {
  const {
    data: roles,
    error: rolesError,
    isLoading: rolesLoading,
  } = useSWR(API_ROUTES.role.list, (url) =>
    api.get(url).then((res) => res.data),
  );

  const {
    data: permissions,
    error: permissionsError,
    isLoading: permissionsLoading,
  } = useSWR(API_ROUTES.role.permissions, (url) =>
    api.get(url).then((res) => res.data),
  );

  const refresh = useCallback(() => {
    mutate(API_ROUTES.role.list);
    mutate(API_ROUTES.role.permissions);
  }, []);

  const updateRole = useCallback(
    async (uuid: string, payload: any) => {
      const res = await api.put(API_ROUTES.role.update(uuid), payload);
      refresh();
      return res.data;
    },
    [refresh],
  );

  return {
    roles,
    rolesError,
    rolesLoading,
    permissions,
    permissionsError,
    permissionsLoading,
    updateRole,
    refresh,
  };
}
