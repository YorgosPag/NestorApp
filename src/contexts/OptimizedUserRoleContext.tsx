'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useCache } from './CacheProvider';

export type UserRole = 'admin' | 'public' | 'authenticated';

interface User {
  email: string;
  role: UserRole;
  isAuthenticated: boolean;
  lastLogin?: number;
  preferences?: Record<string, any>;
}

interface UserRoleContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updatePreferences: (preferences: Record<string, any>) => void;
  isAdmin: boolean;
  isPublic: boolean;
  isAuthenticated: boolean;
  sessionTimeRemaining: number | null;
}

const UserRoleContext = createContext<UserRoleContextType | null>(null);

const ADMIN_EMAILS = [
  'admin@pagonis.gr',
  'nestor@pagonis.gr', 
  'manager@pagonis.gr',
  'user@example.com'
];

const TEST_PUBLIC_USER = {
  email: 'test@pagonis.gr',
  password: '123456'
};

const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
const USER_CACHE_KEY = 'current-user';
const PREFERENCES_CACHE_KEY = 'user-preferences';

export function OptimizedUserRoleProvider({ children }: { children: React.ReactNode }) {
  const cache = useCache();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);

  // Memoized derived values
  const derivedValues = useMemo(() => ({
    isAdmin: user?.role === 'admin',
    isPublic: !user?.isAuthenticated,
    isAuthenticated: user?.isAuthenticated || false
  }), [user]);

  // Session time remaining
  const sessionTimeRemaining = useMemo(() => {
    if (!sessionExpiry) return null;
    const remaining = sessionExpiry - Date.now();
    return remaining > 0 ? remaining : 0;
  }, [sessionExpiry]);

  // Load user from cache or localStorage
  const loadUserFromStorage = useCallback(async () => {
    try {
      // First check cache
      const cachedUser = cache.get<User>(USER_CACHE_KEY);
      if (cachedUser && !cachedUser.stale) {
        setUser(cachedUser.data);
        const expiry = cachedUser.timestamp + SESSION_DURATION;
        setSessionExpiry(expiry);
        return;
      }

      // Fallback to localStorage
      const savedUser = localStorage.getItem('currentUser');
      const savedExpiry = localStorage.getItem('sessionExpiry');
      
      if (savedUser && savedExpiry) {
        const userData = JSON.parse(savedUser);
        const expiryTime = parseInt(savedExpiry);
        
        // Check if session is still valid
        if (Date.now() < expiryTime) {
          const userWithPrefs = {
            ...userData,
            preferences: cache.get(PREFERENCES_CACHE_KEY)?.data || {}
          };
          
          setUser(userWithPrefs);
          setSessionExpiry(expiryTime);
          
          // Update cache
          cache.set(USER_CACHE_KEY, userWithPrefs, { 
            ttl: expiryTime - Date.now() 
          });
          return;
        }
      }

      // Auto-login for development
      const devUser: User = {
        email: 'user@example.com',
        role: 'admin',
        isAuthenticated: true,
        lastLogin: Date.now(),
        preferences: {}
      };
      
      await setUserSession(devUser);
      
    } catch (error) {
      console.error('Error loading user:', error);
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [cache]);

  // Set user session with caching
  const setUserSession = useCallback(async (userData: User) => {
    const now = Date.now();
    const expiry = now + SESSION_DURATION;
    const userWithTimestamp = {
      ...userData,
      lastLogin: now
    };

    setUser(userWithTimestamp);
    setSessionExpiry(expiry);

    // Update cache
    cache.set(USER_CACHE_KEY, userWithTimestamp, { 
      ttl: SESSION_DURATION 
    });

    // Update localStorage as backup
    localStorage.setItem('currentUser', JSON.stringify(userWithTimestamp));
    localStorage.setItem('sessionExpiry', expiry.toString());
    
    // Cache preferences separately
    if (userData.preferences) {
      cache.set(PREFERENCES_CACHE_KEY, userData.preferences, {
        ttl: SESSION_DURATION
      });
    }
  }, [cache]);

  // Clear session
  const clearSession = useCallback(() => {
    setUser(null);
    setSessionExpiry(null);
    cache.invalidate(USER_CACHE_KEY);
    cache.invalidate(PREFERENCES_CACHE_KEY);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('sessionExpiry');
  }, [cache]);

  // Login with caching optimization
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      // Simulate API call with delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      let newUser: User;

      if (ADMIN_EMAILS.includes(email.toLowerCase())) {
        newUser = {
          email: email.toLowerCase(),
          role: 'admin',
          isAuthenticated: true,
          preferences: {}
        };
      } else if (email.toLowerCase() === TEST_PUBLIC_USER.email && password === TEST_PUBLIC_USER.password) {
        newUser = {
          email: email.toLowerCase(),
          role: 'authenticated',
          isAuthenticated: true,
          preferences: {}
        };
      } else {
        return false;
      }

      await setUserSession(newUser);
      return true;
      
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, [setUserSession]);

  // Logout with cleanup
  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  // Update user preferences with optimistic updates
  const updatePreferences = useCallback((newPreferences: Record<string, any>) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      preferences: { ...user.preferences, ...newPreferences }
    };

    // Optimistic update
    setUser(updatedUser);
    
    // Update caches
    cache.set(USER_CACHE_KEY, updatedUser, { 
      ttl: sessionTimeRemaining || SESSION_DURATION 
    });
    cache.set(PREFERENCES_CACHE_KEY, updatedUser.preferences, {
      ttl: sessionTimeRemaining || SESSION_DURATION  
    });

    // Background sync to localStorage
    try {
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    } catch (error) {
      console.warn('Failed to save preferences to localStorage:', error);
    }
  }, [user, cache, sessionTimeRemaining]);

  // Load user on mount
  useEffect(() => {
    loadUserFromStorage();
  }, [loadUserFromStorage]);

  // Session expiry check
  useEffect(() => {
    if (!sessionExpiry) return;

    const checkSession = () => {
      if (Date.now() >= sessionExpiry) {
        clearSession();
      }
    };

    const interval = setInterval(checkSession, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [sessionExpiry, clearSession]);

  // Auto-refresh session when close to expiry (last 30 minutes)
  useEffect(() => {
    if (!sessionExpiry || !user) return;

    const timeUntilExpiry = sessionExpiry - Date.now();
    const refreshThreshold = 30 * 60 * 1000; // 30 minutes

    if (timeUntilExpiry <= refreshThreshold && timeUntilExpiry > 0) {
      // Simulate session refresh
      setUserSession(user);
    }
  }, [sessionExpiry, user, setUserSession]);

  const value: UserRoleContextType = {
    user,
    isLoading,
    login,
    logout,
    updatePreferences,
    sessionTimeRemaining,
    ...derivedValues
  };

  return (
    <UserRoleContext.Provider value={value}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useOptimizedUserRole() {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useOptimizedUserRole must be used within an OptimizedUserRoleProvider');
  }
  return context;
}

// Performance-optimized sidebar type hook with caching
export function useOptimizedSidebarType() {
  const { isAdmin, isPublic } = useOptimizedUserRole();
  const cache = useCache();
  
  return useMemo(() => {
    const cacheKey = `sidebar-type-${isAdmin}-${isPublic}`;
    
    // Check cache first
    const cached = cache.get<string>(cacheKey);
    if (cached && !cached.stale) {
      return cached.data;
    }
    
    // Compute and cache result
    const sidebarType = isAdmin ? 'admin' : 'public';
    cache.set(cacheKey, sidebarType, { ttl: 60000 }); // Cache for 1 minute
    
    return sidebarType;
  }, [isAdmin, isPublic, cache]);
}

// Hook for preloading user-related data
export function useUserDataPreloader() {
  const cache = useCache();
  const { user, isAuthenticated } = useOptimizedUserRole();

  return useCallback(async () => {
    if (!isAuthenticated || !user) return;

    // Preload common user data
    const preloadTasks = [
      cache.prefetch('user-settings', async () => {
        // Simulate fetching user settings
        return user.preferences || {};
      }, { ttl: 10 * 60 * 1000 }),
      
      cache.prefetch('user-permissions', async () => {
        // Simulate fetching permissions
        return user.role === 'admin' ? ['read', 'write', 'admin'] : ['read'];
      }, { ttl: 15 * 60 * 1000 })
    ];

    await Promise.allSettled(preloadTasks);
  }, [cache, isAuthenticated, user]);
}