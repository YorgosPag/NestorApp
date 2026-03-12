'use client';

// =============================================================================
// 🎯 USER TYPE CONTEXT - GEO-ALERT USER TYPE MANAGEMENT
// =============================================================================
//
// Enterprise-grade user type management for GEO-ALERT system
// Separated from authentication (Single Responsibility Principle)
//
// User Types:
// - citizen: Simple point/polygon selection
// - professional: Image/PDF upload with auto-detection
// - technical: Full DXF/DWG support with CAD precision
//
// =============================================================================

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { UserType, UserTypeContextType } from '../types/auth.types';

import { createModuleLogger } from '@/lib/telemetry';
import { safeGetItem, safeSetItem, STORAGE_KEYS } from '@/lib/storage';
const logger = createModuleLogger('UserTypeContext');

// =============================================================================
// CONTEXT CREATION
// =============================================================================

const UserTypeContext = createContext<UserTypeContextType | null>(null);

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

interface UserTypeProviderProps {
  children: React.ReactNode;
  defaultUserType?: UserType;
}

export function UserTypeProvider({
  children,
  defaultUserType = 'citizen'
}: UserTypeProviderProps) {
  const [userType, setUserTypeState] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user type from localStorage on mount
  useEffect(() => {
    const stored = safeGetItem(STORAGE_KEYS.USER_TYPE, '');
    if (stored && isValidUserType(stored)) {
      setUserTypeState(stored as UserType);
    } else {
      setUserTypeState(defaultUserType);
    }
    setIsLoading(false);
  }, [defaultUserType]);

  // Set user type and persist to localStorage
  const setUserType = useCallback((type: UserType) => {
    setUserTypeState(type);
    safeSetItem(STORAGE_KEYS.USER_TYPE, type);
  }, []);

  // Computed properties
  const isCitizen = useMemo(() => userType === 'citizen', [userType]);
  const isProfessional = useMemo(() => userType === 'professional', [userType]);
  const isTechnical = useMemo(() => userType === 'technical', [userType]);

  // Context value
  const contextValue = useMemo<UserTypeContextType>(() => ({
    userType,
    setUserType,
    isCitizen,
    isProfessional,
    isTechnical,
    isLoading
  }), [userType, setUserType, isCitizen, isProfessional, isTechnical, isLoading]);

  return (
    <UserTypeContext.Provider value={contextValue}>
      {children}
    </UserTypeContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to access user type context
 * @throws Error if used outside UserTypeProvider
 */
export function useUserType(): UserTypeContextType {
  const context = useContext(UserTypeContext);

  if (!context) {
    throw new Error(
      '🔴 useUserType must be used within a UserTypeProvider. ' +
      'Wrap your component tree with <UserTypeProvider>.'
    );
  }

  return context;
}

/**
 * Optional hook that returns null instead of throwing
 * Useful for components that may render outside the provider
 */
export function useUserTypeOptional(): UserTypeContextType | null {
  return useContext(UserTypeContext);
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Type guard for UserType validation
 */
function isValidUserType(value: string): value is UserType {
  return ['citizen', 'professional', 'technical'].includes(value);
}

/**
 * Get user type display label
 */
export function getUserTypeLabel(type: UserType): string {
  const labels: Record<UserType, string> = {
    citizen: 'Πολίτης',
    professional: 'Επαγγελματίας',
    technical: 'Τεχνικός'
  };
  return labels[type];
}

/**
 * Get user type capabilities description
 */
export function getUserTypeCapabilities(type: UserType): string[] {
  const capabilities: Record<UserType, string[]> = {
    citizen: [
      'Επιλογή σημείου στον χάρτη',
      'Σχεδίαση απλού πολυγώνου',
      'Βασική περιγραφή ακινήτου'
    ],
    professional: [
      'Όλες οι δυνατότητες Πολίτη',
      'Upload εικόνας/PDF',
      'Αυτόματη ανίχνευση ορίων',
      'Προηγμένη περιγραφή'
    ],
    technical: [
      'Όλες οι δυνατότητες Επαγγελματία',
      'Upload DXF/DWG αρχείων',
      'CAD precision εργαλεία',
      'Τεχνικές μετρήσεις',
      'Εξαγωγή σε CAD formats'
    ]
  };
  return capabilities[type];
}
