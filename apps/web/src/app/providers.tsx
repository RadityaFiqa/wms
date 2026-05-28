'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const { refresh, logout } = useAuth();

  useEffect(() => {
    async function initAuth() {
      try {
        await refresh();
      } catch (err) {
        logout();
      } finally {
        setInitialized(true);
      }
    }
    initAuth();
  }, [refresh, setInitialized, logout]);

  return <>{children}</>;
}
