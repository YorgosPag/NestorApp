'use client';

import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, setDoc, Timestamp, serverTimestamp, where, orderBy, type DocumentData } from 'firebase/firestore';
import { normalizeToTimestamp } from '@/lib/firestore/utils';
import { generateTaskId } from '@/services/enterprise-id.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import { firestoreQueryService } from '@/services/firestore';
import type { CrmTask } from '@/types/crm';
import type { ITasksRepository } from '../contracts';
import { toTask } from '../mappers';
import { isToday, isPast } from 'date-fns';

const TASKS_COLLECTION = COLLECTIONS.TASKS;

export class TasksRepository implements ITasksRepository {
  private collectionName = TASKS_COLLECTION;

  async add(data: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>): Promise<{ id: string; }> {
    const { uid, companyId } = await firestoreQueryService.requireAuthContext();

    // Super admin must specify companyId when creating tasks
    const taskCompanyId = (data as Record<string, unknown>).companyId as string | undefined || companyId;
    if (!taskCompanyId) {
      throw new Error('VALIDATION_ERROR: companyId is required to create a task');
    }

    // ADR-218 Phase 2: Centralized timestamp conversion
    const dueDateTimestamp = data.dueDate ? normalizeToTimestamp(data.dueDate) : null;

    const payload: Record<string, unknown> = {
      ...data,
      dueDate: dueDateTimestamp,
      companyId: taskCompanyId,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: null,
      reminderSent: false,
    };

    // ADR-210: Enterprise ID generation — setDoc with pre-generated ID
    const id = generateTaskId();
    await setDoc(doc(db, this.collectionName, id), { ...payload, id });
    return { id };
  }

  // --- ADR-214 Phase 4: READ methods delegated to firestoreQueryService ---

  async getById(taskId: string): Promise<CrmTask | null> {
    const raw = await firestoreQueryService.getById<DocumentData & { id: string }>('TASKS', taskId);
    if (!raw) return null;
    return toTask(raw);
  }

  async getAll(): Promise<CrmTask[]> {
    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('TASKS', {
      constraints: [orderBy('dueDate', 'asc')],
    });
    return result.documents.map(toTask);
  }

  async getByUser(userId: string): Promise<CrmTask[]> {
    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('TASKS', {
      constraints: [
        where('assignedTo', '==', userId),
        orderBy('dueDate', 'asc'),
      ],
    });
    return result.documents.map(toTask);
  }

  async getByLead(leadId: string): Promise<CrmTask[]> {
    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('TASKS', {
      constraints: [
        where('leadId', '==', leadId),
        orderBy('dueDate', 'asc'),
      ],
    });
    return result.documents.map(toTask);
  }

  async getByStatus(status: CrmTask['status']): Promise<CrmTask[]> {
    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('TASKS', {
      constraints: [
        where('status', '==', status),
        orderBy('dueDate', 'asc'),
      ],
    });
    return result.documents.map(toTask);
  }

  async getOverdue(): Promise<CrmTask[]> {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('TASKS', {
      constraints: [
        where('status', 'in', ['pending', 'in_progress']),
        where('dueDate', '<=', Timestamp.fromDate(today)),
        orderBy('dueDate', 'asc'),
      ],
    });
    return result.documents.map(toTask);
  }

  // --- WRITE methods remain unchanged ---

  async update(id: string, updates: Partial<CrmTask>): Promise<void> {
    const updatePayload: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };

    if (updates.dueDate !== undefined) {
      updatePayload.dueDate = updates.dueDate === null ? null : normalizeToTimestamp(updates.dueDate);
    }

    await updateDoc(doc(db, this.collectionName, id), updatePayload);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }

  async deleteAll(): Promise<number> {
    // Safety: super admin without companyId must NOT bulk-delete
    const ctx = await firestoreQueryService.requireAuthContext();
    if (ctx.isSuperAdmin && !ctx.companyId) {
      throw new Error('SAFETY_ERROR: Super admin must specify companyId to delete tasks');
    }

    // Tenant-aware read via firestoreQueryService
    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('TASKS');
    if (result.isEmpty) return 0;

    const deletePromises = result.documents.map(d =>
      deleteDoc(doc(db, this.collectionName, d.id))
    );
    await Promise.all(deletePromises);
    return deletePromises.length;
  }

  async getStats(userId?: string | null) {
    // Build constraints: exclude cancelled, optionally filter by user
    const statsConstraints = [
      where('status', '!=', 'cancelled'),
      ...(userId ? [where('assignedTo', '==', userId)] : []),
    ];

    const result = await firestoreQueryService.getAll<DocumentData & { id: string }>('TASKS', {
      constraints: statsConstraints,
    });
    const tasks = result.documents.map(toTask);

    const stats = {
      total: 0, pending: 0, inProgress: 0, completed: 0, cancelled: 0, overdue: 0,
      dueToday: 0, dueThisWeek: 0, byPriority: { low: 0, medium: 0, high: 0, urgent: 0 },
      byType: {} as Record<string, number>
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    tasks.forEach(task => {
      stats.total++;
      if (task.status === 'pending') stats.pending++;
      if (task.status === 'in_progress') stats.inProgress++;
      if (task.status === 'completed') stats.completed++;

      stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
      stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;

      if (task.dueDate) {
        const dueDate = new Date(task.dueDate as Date);
        if ((task.status === 'pending' || task.status === 'in_progress') && isPast(dueDate) && !isToday(dueDate)) {
          stats.overdue++;
        }
        if (isToday(dueDate)) stats.dueToday++;
        if (dueDate >= today && dueDate <= weekFromNow) stats.dueThisWeek++;
      }
    });

    return stats;
  }
}
