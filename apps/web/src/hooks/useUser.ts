import { useCallback } from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";

export function useUser(query?: {
  search?: string;
  roleId?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}) {
  const queryString = query
    ? `?page=${query.page || 1}&limit=${query.limit || 10}&search=${query.search || ""}&roleId=${query.roleId || ""}&isActive=${query.isActive || ""}`
    : "";

  const { data, error, isLoading } = useSWR(
    `${API_ROUTES.user.list}${queryString}`,
    (url) => api.get(url).then((res) => res.data),
  );

  const refresh = useCallback(
    () =>
      mutate(
        (key) =>
          typeof key === "string" && key.startsWith(API_ROUTES.user.list),
      ),
    [],
  );

  const createUser = useCallback(
    async (payload: any) => {
      const res = await api.post(API_ROUTES.user.create, payload);
      refresh();
      return res.data;
    },
    [refresh],
  );

  const updateUser = useCallback(
    async (uuid: string, payload: any) => {
      const res = await api.put(API_ROUTES.user.update(uuid), payload);
      refresh();
      return res.data;
    },
    [refresh],
  );

  const toggleStatus = useCallback(
    async (uuid: string, action: "activate" | "deactivate") => {
      const res = await api.post(API_ROUTES.user.status(uuid, action));
      refresh();
      return res.data;
    },
    [refresh],
  );

  const resetPassword = useCallback(async (uuid: string) => {
    const res = await api.post(API_ROUTES.user.resetPassword(uuid));
    return res.data;
  }, []);

  return {
    usersData: data,
    error,
    isLoading,
    refresh,
    createUser,
    updateUser,
    toggleStatus,
    resetPassword,
  };
}
