'use client';

/**
 * 🏢 ENTERPRISE: Client-side Projects Service
 *
 * Provides client-side CRUD operations for Projects with real-time sync.
 * Uses Firebase client SDK for direct Firestore operations.
 * Dispatches events via RealtimeService for cross-page synchronization.
 *
 * NOTE: Server-side operations (server actions) are in projects.service.ts
 * This file is for client-side operations that need immediate real-time dispatch.
 */

import { collection, getDocs, query, orderBy, limit, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { Project } from '@/types/project';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService } from '@/services/realtime';

/**
 * 🏢 ENTERPRISE: Project create payload type
 * Type-safe data for project creation
 */
export interface ProjectCreatePayload {
  name: string;
  title?: string;
  description?: string;
  status?: string;
  companyId: string;
  company?: string;
  address?: string;
  city?: string;
}

/**
 * 🏢 ENTERPRISE: Project update payload type
 * Type-safe updates for project modifications
 */
export interface ProjectUpdatePayload {
  name?: string;
  title?: string;
  description?: string;
  status?: string;
  address?: string;
  city?: string;
}

/**
 * 🎯 ENTERPRISE: Δημιουργία νέου έργου στο Firebase (Client-side)
 * Αποθηκεύει τα δεδομένα στη βάση και ενημερώνει το real-time service
 */
export async function createProject(
  data: ProjectCreatePayload
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    console.log(`🎯 [createProject] Creating new project...`);

    const projectsRef = collection(db, COLLECTIONS.PROJECTS);
    const docRef = await addDoc(projectsRef, {
      ...data,
      progress: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log(`✅ [createProject] Project created with ID: ${docRef.id}`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchProjectCreated({
      projectId: docRef.id,
      project: {
        name: data.name,
        title: data.title,
        status: data.status,
        companyId: data.companyId,
      },
      timestamp: Date.now()
    });

    return { success: true, projectId: docRef.id };

  } catch (error) {
    console.error('❌ [createProject] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🎯 ENTERPRISE: Ενημέρωση έργου στο Firebase (Client-side)
 * Αποθηκεύει τα δεδομένα στη βάση και ενημερώνει το real-time service
 *
 * NOTE: Prefer using server action updateProject() from projects.service.ts
 * Use this only when you need immediate client-side dispatch
 */
export async function updateProjectClient(
  projectId: string,
  updates: ProjectUpdatePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🎯 [updateProjectClient] Updating project ${projectId}...`);

    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    await updateDoc(projectRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ [updateProjectClient] Project ${projectId} updated successfully`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchProjectUpdated({
      projectId,
      updates: {
        name: updates.name,
        title: updates.title,
        status: updates.status,
      },
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    console.error('❌ [updateProjectClient] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🎯 ENTERPRISE: Διαγραφή έργου από το Firebase (Client-side)
 * Διαγράφει τα δεδομένα από τη βάση και ενημερώνει το real-time service
 */
export async function deleteProject(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`🎯 [deleteProject] Deleting project ${projectId}...`);

    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    await deleteDoc(projectRef);

    console.log(`✅ [deleteProject] Project ${projectId} deleted successfully`);

    // 🏢 ENTERPRISE: Centralized Real-time Service (cross-page sync)
    RealtimeService.dispatchProjectDeleted({
      projectId,
      timestamp: Date.now()
    });

    return { success: true };

  } catch (error) {
    console.error('❌ [deleteProject] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 🎯 ENTERPRISE: Λίστα έργων από Firebase (Client-side)
 * Για περιπτώσεις που χρειάζεται client-side fetch
 */
export async function getProjectsClient(limitCount: number = 100): Promise<Project[]> {
  try {
    console.log('🔍 [getProjectsClient] Starting Firestore query...');

    const projectsQuery = query(
      collection(db, COLLECTIONS.PROJECTS),
      orderBy('name', 'asc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(projectsQuery);

    const projects = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as Project[];

    console.log(`✅ [getProjectsClient] Loaded ${projects.length} projects from Firebase`);
    return projects;

  } catch (error) {
    console.error('❌ [getProjectsClient] Error:', error);
    return [];
  }
}
