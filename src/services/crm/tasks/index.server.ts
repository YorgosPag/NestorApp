'use server';

import type { CrmTask } from '@/types/crm';

// Mock implementation for server-side - replace with actual server repo later
class MockTasksRepository {
  async getAllTasks(): Promise<CrmTask[]> {
    // Return empty array for now - this should connect to actual database
    return [];
  }

  async addTask(taskData: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    console.log('Mock: Task would be added:', taskData);
    return 'mock-id';
  }

  async updateTask(id: string, updates: Partial<CrmTask>): Promise<void> {
    console.log('Mock: Task would be updated:', id, updates);
  }

  async deleteTask(id: string): Promise<void> {
    console.log('Mock: Task would be deleted:', id);
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
    console.log('Mock: Task would be completed:', id, notes);
  }

  async getTasksStats(userId?: string): Promise<any> {
    return { total: 0, completed: 0, pending: 0, overdue: 0 };
  }

  async deleteAllTasks(): Promise<void> {
    console.log('Mock: All tasks would be deleted');
  }
}

const repo = new MockTasksRepository();

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
