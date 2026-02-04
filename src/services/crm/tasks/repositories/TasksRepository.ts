'use client';

import { auth, db } from '@/lib/firebase';
import { collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { CrmTask } from '@/types/crm';
import type { ITasksRepository } from '../contracts';
import { transformTask } from '../mappers';
import { isToday, isPast, isTomorrow } from 'date-fns';

const TASKS_COLLECTION = COLLECTIONS.TASKS;
const BATCH_SIZE = 500;

export class TasksRepository implements ITasksRepository {
  private collectionName = TASKS_COLLECTION;

  private async requireAuthContext(): Promise<{ uid: string; companyId: string }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('AUTHENTICATION_ERROR: User must be logged in to access tasks');
    }

    const tokenResult = await currentUser.getIdTokenResult();
    const companyId = tokenResult.claims?.companyId as string | undefined;

    if (!companyId) {
      throw new Error('AUTHORIZATION_ERROR: User is not assigned to a company');
    }

    return { uid: currentUser.uid, companyId };
  }

  async add(data: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>): Promise<{ id: string; }> {
    const { uid, companyId } = await this.requireAuthContext();

    // 🏢 ENTERPRISE: Proper FirestoreishTimestamp → Timestamp conversion
    let dueDateTimestamp: Timestamp | null = null;
    if (data.dueDate) {
      if (data.dueDate instanceof Timestamp) {
        dueDateTimestamp = data.dueDate;
      } else if (data.dueDate instanceof Date) {
        dueDateTimestamp = Timestamp.fromDate(data.dueDate);
      } else if (typeof data.dueDate === 'string') {
        dueDateTimestamp = Timestamp.fromDate(new Date(data.dueDate));
      } else if (typeof data.dueDate === 'object' && 'toDate' in data.dueDate) {
        dueDateTimestamp = Timestamp.fromDate(data.dueDate.toDate());
      }
    }
    
    const payload: Record<string, unknown> = {
      ...data,
      dueDate: dueDateTimestamp,
      companyId,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: null,
      reminderSent: false,
    };

    const docRef = await addDoc(collection(db, this.collectionName), payload);
    return { id: docRef.id };
  }

  async getById(taskId: string): Promise<CrmTask | null> {
    const snapshot = await getDoc(doc(db, this.collectionName, taskId));
    if (!snapshot.exists()) {
      return null;
    }
    return transformTask(snapshot);
  }

  async getAll(): Promise<CrmTask[]> {
    const { companyId } = await this.requireAuthContext();
    const q = query(
      collection(db, this.collectionName),
      where('companyId', '==', companyId),
      orderBy('dueDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformTask);
  }

  async getByUser(userId: string): Promise<CrmTask[]> {
    const { companyId } = await this.requireAuthContext();
    const q = query(
      collection(db, this.collectionName),
      where('companyId', '==', companyId),
      where('assignedTo', '==', userId),
      orderBy('dueDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformTask);
  }

  async getByLead(leadId: string): Promise<CrmTask[]> {
    const { companyId } = await this.requireAuthContext();
    const q = query(
      collection(db, this.collectionName),
      where('companyId', '==', companyId),
      where('leadId', '==', leadId),
      orderBy('dueDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformTask);
  }
  
  async getByStatus(status: CrmTask['status']): Promise<CrmTask[]> {
    const { companyId } = await this.requireAuthContext();
    const q = query(
      collection(db, this.collectionName),
      where('companyId', '==', companyId),
      where('status', '==', status),
      orderBy('dueDate', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformTask);
  }
  
  async getOverdue(): Promise<CrmTask[]> {
    const { companyId } = await this.requireAuthContext();
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const q = query(
      collection(db, this.collectionName),
      where('companyId', '==', companyId),
      where('status', 'in', ['pending', 'in_progress']),
      where('dueDate', '<=', Timestamp.fromDate(today)),
      orderBy('dueDate', 'asc')
    );
      
    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformTask);
  }

  async update(id: string, updates: Partial<CrmTask>): Promise<void> {
    const updatePayload: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };

    // 🏢 ENTERPRISE: Proper FirestoreishTimestamp → Timestamp conversion for updates
    if (updates.dueDate !== undefined) {
      if (updates.dueDate === null) {
        updatePayload.dueDate = null;
      } else if (updates.dueDate instanceof Timestamp) {
        updatePayload.dueDate = updates.dueDate;
      } else if (updates.dueDate instanceof Date) {
        updatePayload.dueDate = Timestamp.fromDate(updates.dueDate);
      } else if (typeof updates.dueDate === 'string') {
        updatePayload.dueDate = Timestamp.fromDate(new Date(updates.dueDate));
      } else if (typeof updates.dueDate === 'object' && 'toDate' in updates.dueDate) {
        updatePayload.dueDate = Timestamp.fromDate(updates.dueDate.toDate());
      }
    }

    await updateDoc(doc(db, this.collectionName, id), updatePayload);
  }
  
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }

  async deleteAll(): Promise<number> {
    const { companyId } = await this.requireAuthContext();
    const q = query(
      collection(db, this.collectionName),
      where('companyId', '==', companyId)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return 0;
    
    // Simple delete all for client-side (no batch operations for simplicity)
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    return deletePromises.length;
  }

  async getStats(userId?: string | null) {
    const { companyId } = await this.requireAuthContext();
    let q = query(
      collection(db, this.collectionName),
      where('companyId', '==', companyId),
      where('status', '!=', 'cancelled')
    );
    if (userId) {
      q = query(q, where('assignedTo', '==', userId));
    }
    
    const snapshot = await getDocs(q);
    const tasks = snapshot.docs.map(transformTask);

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
