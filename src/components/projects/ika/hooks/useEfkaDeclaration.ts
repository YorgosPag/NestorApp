'use client';

/**
 * =============================================================================
 * useEfkaDeclaration — Hook for EFKA declaration data
 * =============================================================================
 *
 * Reads/writes efkaDeclaration field on the project document.
 * No new collection — stored as sub-object on existing project.
 *
 * @module components/projects/ika/hooks/useEfkaDeclaration
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { EfkaDeclarationData, EfkaDeclarationStatus } from '../contracts';
import { createDefaultEfkaDeclaration } from '../contracts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useEfkaDeclaration');

interface UseEfkaDeclarationReturn {
  declaration: EfkaDeclarationData | null;
  isLoading: boolean;
  error: string | null;
  /** Save updated declaration fields */
  saveDeclaration: (updates: Partial<EfkaDeclarationData>) => Promise<boolean>;
  /** Update just the status */
  updateStatus: (status: EfkaDeclarationStatus) => Promise<boolean>;
  /** Initialize declaration if it doesn't exist */
  initializeDeclaration: (userId: string) => Promise<boolean>;
  /** Number of completed checklist fields (0-7) */
  completedFields: number;
  /** Total required fields */
  totalFields: number;
  /** Force refetch */
  refetch: () => void;
}

const REQUIRED_FIELDS: (keyof EfkaDeclarationData)[] = [
  'employerVatNumber',
  'projectAddress',
  'projectDescription',
  'startDate',
  'estimatedEndDate',
  'estimatedWorkerCount',
  'projectCategory',
];

/**
 * Count how many of the 7 required fields have values.
 */
function countCompletedFields(declaration: EfkaDeclarationData | null): number {
  if (!declaration) return 0;

  return REQUIRED_FIELDS.reduce((count, field) => {
    const value = declaration[field];
    if (value !== null && value !== undefined && value !== '') {
      return count + 1;
    }
    return count;
  }, 0);
}

export function useEfkaDeclaration(projectId: string | undefined): UseEfkaDeclarationReturn {
  const [declaration, setDeclaration] = useState<EfkaDeclarationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Load declaration from project document
  useEffect(() => {
    let mounted = true;

    async function loadDeclaration() {
      if (!projectId) {
        setDeclaration(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
        const projectSnap = await getDoc(projectRef);

        if (!mounted) return;

        if (!projectSnap.exists()) {
          setError('Project not found');
          setDeclaration(null);
          return;
        }

        const projectData = projectSnap.data();
        const efkaData = projectData?.efkaDeclaration as EfkaDeclarationData | undefined;

        setDeclaration(efkaData ?? null);
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'Failed to load EFKA declaration';
          setError(message);
          logger.error('Failed to load EFKA declaration', { error: message });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadDeclaration();
    return () => { mounted = false; };
  }, [projectId, refreshKey]);

  // Save partial updates to declaration
  const saveDeclaration = useCallback(async (updates: Partial<EfkaDeclarationData>): Promise<boolean> => {
    if (!projectId) return false;

    try {
      const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);

      // Build the update object with dot notation for nested field
      const updatePayload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };

      // Merge updates into efkaDeclaration
      const currentDeclaration = declaration ?? createDefaultEfkaDeclaration('system');
      const mergedDeclaration: EfkaDeclarationData = {
        ...currentDeclaration,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      updatePayload['efkaDeclaration'] = mergedDeclaration;

      await updateDoc(projectRef, updatePayload);
      setDeclaration(mergedDeclaration);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save declaration';
      setError(message);
      logger.error('Failed to save EFKA declaration', { error: message });
      return false;
    }
  }, [projectId, declaration]);

  // Update status only
  const updateStatus = useCallback(async (status: EfkaDeclarationStatus): Promise<boolean> => {
    return saveDeclaration({ status });
  }, [saveDeclaration]);

  // Initialize declaration if it doesn't exist
  const initializeDeclaration = useCallback(async (userId: string): Promise<boolean> => {
    if (!projectId || declaration) return false;

    try {
      const newDeclaration = createDefaultEfkaDeclaration(userId);
      const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);

      await updateDoc(projectRef, {
        efkaDeclaration: newDeclaration,
        updatedAt: serverTimestamp(),
      });

      setDeclaration(newDeclaration);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize declaration';
      setError(message);
      logger.error('Failed to initialize EFKA declaration', { error: message });
      return false;
    }
  }, [projectId, declaration]);

  const completedFields = countCompletedFields(declaration);

  return {
    declaration,
    isLoading,
    error,
    saveDeclaration,
    updateStatus,
    initializeDeclaration,
    completedFields,
    totalFields: REQUIRED_FIELDS.length,
    refetch,
  };
}
