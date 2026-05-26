import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPayload {
  uuid: string;
  email: string;
  name: string;
  isFirstLogin: boolean;
  role: string;
  permissions: { action: string; subject: string }[];
  warehouse: { uuid: string; name: string } | null;
}

interface AuthState {
  user: UserPayload | null;
  token: string | null;
  isInitialized: boolean;
  setAuth: (user: UserPayload, token: string) => void;
  setInitialized: (initialized: boolean) => void;
  logout: () => void;
  hasPermission: (action: string, subject: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isInitialized: false,
      setAuth: (user, token) => set({ user, token }),
      setInitialized: (isInitialized) => set({ isInitialized }),
      logout: () => set({ user: null, token: null }),
      hasPermission: (action, subject) => {
        const user = get().user;
        if (!user) return false;
        
        // Super admin has all permissions
        if (user.role === 'SUPER_ADMIN') return true;
        
        return user.permissions.some(
          (p) => 
            (p.action === 'manage' && p.subject === 'all') || 
            (p.action === action && p.subject === subject) ||
            (p.action === 'manage' && p.subject === subject)
        );
      },
    }),
    {
      name: 'auth-storage',
      // Only persist user metadata and access token, do not persist session state flags
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
