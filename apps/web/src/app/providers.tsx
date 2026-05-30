'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return true;
    const now = Math.floor(Date.now() / 1000);
    // Refresh if token expires in less than 10 seconds to avoid race conditions
    return payload.exp < now + 10;
  } catch (e) {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setInitialized = useAuthStore((state) => state.setInitialized);
  const { refresh, logout } = useAuth();

  useEffect(() => {
    async function initAuth() {
      try {
        const token = useAuthStore.getState().token;
        if (isTokenExpired(token)) {
          await refresh();
        }
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
