'use client';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { CrmTask } from '@/types/crm';
import type { ITasksRepository } from '../contracts';
import { transformTask } from '../mappers';
import { isToday, isPast, isTomorrow } from 'date-fns';

const TASKS_COLLECTION = COLLECTIONS.TASKS;
const BATCH_SIZE = 500;

export class TasksRepository implements ITasksRepository {
  private collectionName = TASKS_COLLECTION;

  async add(data: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>): Promise<{ id: string; }> {
    let dueDateTimestamp = data.dueDate;
    if (dueDateTimestamp && !(dueDateTimestamp instanceof Timestamp)) {
      dueDateTimestamp = Timestamp.fromDate(new Date(dueDateTimestamp));
    }
    
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...data,
      dueDate: dueDateTimestamp,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      completedAt: null,
      reminderSent: false,
    });
    return { id: docRef.id };
  }

  async getAll(): Promise<CrmTask[]> {
    const q = query(collection(db, this.collectionName), orderBy('dueDate', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformTask);
  }

  async getByUser(userId: string): Promise<CrmTask[]> {
    const q = query(collection(db, this.collectionName), where('assignedTo', '==', userId), orderBy('dueDate', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformTask);
  }

  async getByLead(leadId: string): Promise<CrmTask[]> {
    const q = query(collection(db, this.collectionName), where('leadId', '==', leadId), orderBy('dueDate', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformTask);
  }
  
  async getByStatus(status: CrmTask['status']): Promise<CrmTask[]> {
    const q = query(collection(db, this.collectionName), where('status', '==', status), orderBy('dueDate', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformTask);
  }
  
  async getOverdue(): Promise<CrmTask[]> {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const q = query(
      collection(db, this.collectionName),
      where('status', 'in', ['pending', 'in_progress']),
      where('dueDate', '<=', Timestamp.fromDate(today)),
      orderBy('dueDate', 'asc')
    );
      
    const snapshot = await getDocs(q);
    return snapshot.docs.map(transformTask);
  }

  async update(id: string, updates: Partial<CrmTask>): Promise<void> {
    const updatePayload: any = { ...updates, updatedAt: serverTimestamp() };
    if (updates.dueDate && !(updates.dueDate instanceof Timestamp)) {
      updatePayload.dueDate = Timestamp.fromDate(new Date(updates.dueDate));
    }
    await updateDoc(doc(db, this.collectionName, id), updatePayload);
  }
  
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }

  async deleteAll(): Promise<number> {
    const snapshot = await getDocs(collection(db, this.collectionName));
    if (snapshot.empty) return 0;
    
    // Simple delete all for client-side (no batch operations for simplicity)
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    return snapshot.size;
  }

  async getStats(userId?: string | null) {
    let q = query(collection(db, this.collectionName), where('status', '!=', 'cancelled'));
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
