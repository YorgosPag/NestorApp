'use server';

import type { CrmTask } from '@/types/crm';

// Sample implementation for server-side - replace with actual server repo later
class SampleTasksRepository {
  async getAllTasks(): Promise<CrmTask[]> {
    // Return empty array for now - this should connect to actual database
    return [];
  }

  async addTask(taskData: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    // Debug logging removed
    return 'sample-id';
  }

  async updateTask(id: string, updates: Partial<CrmTask>): Promise<void> {
    // Debug logging removed
  }

  async deleteTask(id: string): Promise<void> {
    // Debug logging removed
  }

  async getTasksByUser(userId: string): Promise<CrmTask[]> {
    return [];
  }

  async getTasksByLead(leadId: string): Promise<CrmTask[]> {
    return [];
  }

  async getTasksByStatus(status: CrmTask['status']): Promise<CrmTask[]> {
    return [];
  }

  async getOverdueTasks(): Promise<CrmTask[]> {
    return [];
  }

  async completeTask(id: string, notes?: string): Promise<void> {
    // Debug logging removed
  }

  async getTasksStats(userId?: string): Promise<any> {
    return { total: 0, completed: 0, pending: 0, overdue: 0 };
  }

  async deleteAllTasks(): Promise<void> {
    // Debug logging removed
  }
}

const repo = new SampleTasksRepository();

export const addTask = (taskData: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>) => repo.addTask(taskData);
export const getAllTasks = () => repo.getAllTasks();
export const getTasksByUser = (userId: string) => repo.getTasksByUser(userId);
export const getTasksByLead = (leadId: string) => repo.getTasksByLead(leadId);
export const getTasksByStatus = (status: CrmTask['status']) => repo.getTasksByStatus(status);
export const getOverdueTasks = () => repo.getOverdueTasks();
export const updateTask = (id: string, updates: Partial<CrmTask>) => repo.updateTask(id, updates);
export const deleteTask = (id: string) => repo.deleteTask(id);
export const deleteAllTasks = () => repo.deleteAllTasks();
export const completeTask = (id: string, notes = '') => repo.completeTask(id, notes);
export const getTasksStats = (userId: string | null = null) => repo.getTasksStats(userId);
