import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { getCurrentUser, loginWithCredentials } from '../api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginAs: (role: 'manager' | 'member' | 'admin', userId?: number) => Promise<void>;
  loginWithEmail: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  switchRole: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const u = await getCurrentUser();
      setUser(u);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('syncbrief_user', JSON.stringify(u));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    async function initAuth() {
      try {
        const storage = typeof window !== 'undefined' ? window.localStorage : null;
        const token = storage?.getItem('syncbrief_token');

        if (token) {
          try {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
            storage?.setItem('syncbrief_user', JSON.stringify(currentUser));
          } catch {
            // Token is invalid, expired, or rejected by backend (e.g. 401 Unauthorized)
            storage?.removeItem('syncbrief_token');
            storage?.removeItem('syncbrief_user');
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const loginWithEmail = async (email: string, password = 'demo1234') => {
    setIsLoading(true);
    try {
      const res = await loginWithCredentials(email, password);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('syncbrief_token');
      window.localStorage.removeItem('syncbrief_user');
      window.localStorage.removeItem('syncbrief_refresh_token');
    }
    setUser(null);
  };

  // Persona / role switching as a login bypass is strictly disabled
  const loginAs = async (_role: 'manager' | 'member' | 'admin', _userId?: number) => {
    console.warn('Persona/role switching is disabled in secure multi-tenant mode. Please authenticate using loginWithEmail.');
  };

  const switchRole = async () => {
    console.warn('Role switching bypass is disabled in secure multi-tenant mode. Please authenticate as the target user.');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginAs, loginWithEmail, logout, switchRole, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
