'use server';
import type { CrmTask } from '@/types/crm';
import type { getTasksStats } from './services/TasksService';

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
  getStats(userId?: string|null): Promise<Awaited<ReturnType<typeof getTasksStats>>>;
}

export interface ITasksService {
  addTask(taskData: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>): Promise<{ id: string; success: boolean }>;
  getTaskById(taskId: string): Promise<CrmTask | null>;
  getAllTasks(): Promise<CrmTask[]>;
  getTasksByUser(userId: string): Promise<CrmTask[]>;
  getTasksByLead(leadId: string): Promise<CrmTask[]>;
  getTasksByStatus(status: CrmTask['status']): Promise<CrmTask[]>;
  getOverdueTasks(): Promise<CrmTask[]>;
  updateTask(taskId: string, updates: Partial<CrmTask>): Promise<{ success: boolean }>;
  deleteTask(taskId: string): Promise<{ success: boolean }>;
  deleteAllTasks(): Promise<{ success: boolean; deletedCount: number }>;
  completeTask(taskId: string, notes?: string): Promise<{ success: boolean }>;
  getTasksStats(userId?: string | null): Promise<Awaited<ReturnType<typeof getTasksStats>>>;
}
