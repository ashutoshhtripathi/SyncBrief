import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { demoLogin, getCurrentUser } from '../api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginAs: (role: 'manager' | 'member', userId?: number) => Promise<void>;
  logout: () => void;
  switchRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        const storedUser = localStorage.getItem('syncbrief_user');
        const token = localStorage.getItem('syncbrief_token');
        if (storedUser && token) {
          setUser(JSON.parse(storedUser));
        } else {
          // Auto-login as Sarah Jenkins (Manager) for instant live demo experience
          const res = await demoLogin('manager');
          setUser(res.user);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  const loginAs = async (role: 'manager' | 'member', userId?: number) => {
    setIsLoading(true);
    try {
      const res = await demoLogin(role, userId);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('syncbrief_token');
    localStorage.removeItem('syncbrief_user');
    setUser(null);
  };

  const switchRole = async () => {
    if (user?.role === 'manager') {
      await loginAs('member');
    } else {
      await loginAs('manager');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginAs, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
