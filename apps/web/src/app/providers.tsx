'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/axios';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((state) => state.setAuth);
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    async function initAuth() {
      try {
        const response = await api.post('/auth/refresh');
        const { accessToken, user } = response.data;
        setAuth(user, accessToken);
      } catch (err) {
        logout();
      } finally {
        setInitialized(true);
      }
    }
    initAuth();
  }, [setAuth, setInitialized, logout]);

  return <>{children}</>;
}
