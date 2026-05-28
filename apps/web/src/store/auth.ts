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
  accessibleWarehouses: { uuid: string; name: string }[];
}

interface AuthState {
  user: UserPayload | null;
  token: string | null;
  activeWarehouse: { uuid: string; name: string } | null;
  isInitialized: boolean;
  setAuth: (user: UserPayload, token: string) => void;
  setActiveWarehouse: (warehouse: { uuid: string; name: string } | null) => void;
  setInitialized: (initialized: boolean) => void;
  logout: () => void;
  hasPermission: (action: string, subject: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      activeWarehouse: null,
      isInitialized: false,
      setAuth: (user, token) => {
        // Automatically default active warehouse to the first accessible one if none is selected
        const active = get().activeWarehouse;
        let nextActive = active;
        if (user && user.accessibleWarehouses && user.accessibleWarehouses.length > 0) {
          const hasActive = active ? user.accessibleWarehouses.some(w => w.uuid === active.uuid) : false;
          if (!hasActive) {
            nextActive = user.accessibleWarehouses[0];
          }
        } else {
          nextActive = null;
        }

        set({ user, token, activeWarehouse: nextActive });
      },
      setActiveWarehouse: (activeWarehouse) => set({ activeWarehouse }),
      setInitialized: (isInitialized) => set({ isInitialized }),
      logout: () => set({ user: null, token: null, activeWarehouse: null }),
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
      partialize: (state) => ({ user: state.user, token: state.token, activeWarehouse: state.activeWarehouse }),
    }
  )
);
