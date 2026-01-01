'use server';

import type { CrmTask } from '@/types/crm';

interface TasksStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

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

  async getTasksStats(userId?: string): Promise<TasksStats> {
    return { total: 0, completed: 0, pending: 0, overdue: 0 };
  }

  async deleteAllTasks(): Promise<void> {
    // Debug logging removed
  }
}

const repo = new SampleTasksRepository();

export async function addTask(taskData: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>): Promise<string> {
  return repo.addTask(taskData);
}

export async function getAllTasks(): Promise<CrmTask[]> {
  return repo.getAllTasks();
}

export async function getTasksByUser(userId: string): Promise<CrmTask[]> {
  return repo.getTasksByUser(userId);
}

export async function getTasksByLead(leadId: string): Promise<CrmTask[]> {
  return repo.getTasksByLead(leadId);
}

export async function getTasksByStatus(status: CrmTask['status']): Promise<CrmTask[]> {
  return repo.getTasksByStatus(status);
}

export async function getOverdueTasks(): Promise<CrmTask[]> {
  return repo.getOverdueTasks();
}

export async function updateTask(id: string, updates: Partial<CrmTask>): Promise<void> {
  return repo.updateTask(id, updates);
}

export async function deleteTask(id: string): Promise<void> {
  return repo.deleteTask(id);
}

export async function deleteAllTasks(): Promise<void> {
  return repo.deleteAllTasks();
}

export async function completeTask(id: string, notes = ''): Promise<void> {
  return repo.completeTask(id, notes);
}

export async function getTasksStats(userId: string | null = null): Promise<TasksStats> {
  return repo.getTasksStats(userId);
}
