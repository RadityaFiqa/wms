import { useCallback } from "react";
import { api } from "@/lib/axios";
import { API_ROUTES } from "@/lib/api-routes";
import { useAuthStore } from "@/store/auth";

export function useAuth() {
  const { user, token, activeWarehouse, logout, setAuth, setActiveWarehouse } =
    useAuthStore();

  const handleLogin = useCallback(
    async (data: any) => {
      const res = await api.post(API_ROUTES.auth.login, data);
      const { user: userPayload, accessToken } = res.data;
      setAuth(userPayload, accessToken);
      return res.data;
    },
    [setAuth],
  );

  const handleLogout = useCallback(async () => {
    try {
      await api.post(API_ROUTES.auth.logout);
    } catch (e) {
      // Ignore network failures on logout
    } finally {
      logout();
    }
  }, [logout]);

  const handleRefresh = useCallback(async () => {
    const res = await api.post(API_ROUTES.auth.refresh);
    const { user: userPayload, accessToken } = res.data;
    setAuth(userPayload, accessToken);
    return res.data;
  }, [setAuth]);

  const changePassword = useCallback(async (data: any) => {
    const res = await api.post(API_ROUTES.auth.changePassword, data);
    return res.data;
  }, []);

  const forgotPassword = useCallback(async (data: any) => {
    const res = await api.post(API_ROUTES.auth.forgotPassword, data);
    return res.data;
  }, []);

  const resetPassword = useCallback(async (data: any) => {
    const res = await api.post(API_ROUTES.auth.resetPassword, data);
    return res.data;
  }, []);

  return {
    user,
    token,
    activeWarehouse,
    setActiveWarehouse,
    login: handleLogin,
    logout: handleLogout,
    refresh: handleRefresh,
    changePassword,
    forgotPassword,
    resetPassword,
  };
}
