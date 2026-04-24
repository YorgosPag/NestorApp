'use server';
import type { CrmTask } from '@/types/crm';

export interface TasksStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

export interface ITasksRepository {
  add(data: Omit<CrmTask,'id'|'createdAt'|'updatedAt'|'completedAt'|'reminderSent'>): Promise<{id:string}>;
  getById(taskId: string): Promise<CrmTask | null>;
  getAll(): Promise<CrmTask[]>;
  getByUser(userId: string): Promise<CrmTask[]>;
  getByLead(leadId: string): Promise<CrmTask[]>;
  getByStatus(status: CrmTask['status']): Promise<CrmTask[]>;
  getOverdue(): Promise<CrmTask[]>;
  update(id: string, updates: Partial<CrmTask>): Promise<void>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<number>;
  getStats(userId?: string|null): Promise<TasksStats>;
}
