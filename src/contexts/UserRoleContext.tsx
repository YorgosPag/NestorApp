'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'admin' | 'public' | 'authenticated';

interface User {
  email: string;
  role: UserRole;
  isAuthenticated: boolean;
}

interface UserRoleContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isPublic: boolean;
  isAuthenticated: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | null>(null);

// Hardcoded admin emails
const ADMIN_EMAILS = [
  'admin@pagonis.gr',
  'nestor@pagonis.gr',
  'manager@pagonis.gr',
  'user@example.com',  // Added for DXF Viewer testing
  'developer@pagonis.gr'  // Developer admin user
];

// Test public user
const TEST_PUBLIC_USER = {
  email: 'test@pagonis.gr',
  password: '123456'
};

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = () => {
      try {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
        } else {
          // Auto-login as admin for development/testing
          const devUser: User = {
            email: 'user@example.com',
            role: 'admin',
            isAuthenticated: true
          };
          setUser(devUser);
          localStorage.setItem('currentUser', JSON.stringify(devUser));
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        localStorage.removeItem('currentUser');
        // Fallback auto-login
        const devUser: User = {
          email: 'user@example.com',
          role: 'admin',
          isAuthenticated: true
        };
        setUser(devUser);
        localStorage.setItem('currentUser', JSON.stringify(devUser));
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if admin
      if (ADMIN_EMAILS.includes(email.toLowerCase())) {
        const newUser: User = {
          email: email.toLowerCase(),
          role: 'admin',
          isAuthenticated: true
        };
        setUser(newUser);
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        return true;
      }

      // Check if test public user
      if (email.toLowerCase() === TEST_PUBLIC_USER.email && password === TEST_PUBLIC_USER.password) {
        const newUser: User = {
          email: email.toLowerCase(),
          role: 'authenticated',
          isAuthenticated: true
        };
        setUser(newUser);
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const value: UserRoleContextType = {
    user,
    isLoading,
    login,
    logout,
    isAdmin: user?.role === 'admin',
    isPublic: !user?.isAuthenticated,
    isAuthenticated: user?.isAuthenticated || false
  };

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}

// Hook to determine which sidebar to show
export function useSidebarType() {
  const { isAdmin, isPublic } = useUserRole();
  
  if (isAdmin) return 'admin';
  if (isPublic) return 'public';
  return 'public'; // Default for authenticated non-admin users
}
