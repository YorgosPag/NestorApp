import type { CrmTask } from '@/types/crm';
import type { ITasksService, ITasksRepository, TasksStats } from '../contracts';
import { Timestamp, serverTimestamp } from 'firebase/firestore';

let tasksServiceInstance: TasksService | null = null;

class TasksService implements ITasksService {
  constructor(private repository: ITasksRepository) {}

  async addTask(taskData: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>): Promise<{ id: string; success: boolean; }> {
    try {
      const { id } = await this.repository.add(taskData);
      return { id, success: true };
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async getTaskById(taskId: string): Promise<CrmTask | null> {
    try {
      return await this.repository.getById(taskId);
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async getAllTasks(): Promise<CrmTask[]> {
    try {
      return await this.repository.getAll();
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async getTasksByUser(userId: string): Promise<CrmTask[]> {
    try {
      return await this.repository.getByUser(userId);
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async getTasksByLead(leadId: string): Promise<CrmTask[]> {
    try {
      return await this.repository.getByLead(leadId);
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async getTasksByStatus(status: CrmTask['status']): Promise<CrmTask[]> {
    try {
      return await this.repository.getByStatus(status);
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async getOverdueTasks(): Promise<CrmTask[]> {
    try {
      return await this.repository.getOverdue();
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<CrmTask>): Promise<{ success: boolean; }> {
    try {
      await this.repository.update(taskId, updates);
      return { success: true };
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<{ success: boolean; }> {
    try {
      await this.repository.delete(taskId);
      return { success: true };
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async deleteAllTasks(): Promise<{ success: boolean; deletedCount: number; }> {
    try {
      const deletedCount = await this.repository.deleteAll();
      return { success: true, deletedCount };
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async completeTask(taskId: string, notes: string = ''): Promise<{ success: boolean; }> {
    try {
      const updates: Partial<CrmTask> & { 'metadata.completionNotes'?: string } = {
        status: 'completed',
        completedAt: serverTimestamp() as Timestamp,
      };
      if (notes) {
        updates['metadata.completionNotes'] = notes;
      }
      await this.updateTask(taskId, updates);
      return { success: true };
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }

  async getTasksStats(userId: string | null = null): Promise<TasksStats> {
    try {
      return await this.repository.getStats(userId);
    } catch (error) {
      // Error logging removed
      throw error;
    }
  }
}

export async function createTasksService(repository: ITasksRepository): Promise<TasksService> {
  'use server';
  if (!tasksServiceInstance) {
    tasksServiceInstance = new TasksService(repository);
  }
  return tasksServiceInstance;
}

export async function addTask(taskData: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>, repository: ITasksRepository): Promise<{ id: string; success: boolean; }> {
  'use server';
  const service = await createTasksService(repository);
  return service.addTask(taskData);
}

export async function getAllTasks(repository: ITasksRepository): Promise<CrmTask[]> {
  'use server';
  const service = await createTasksService(repository);
  return service.getAllTasks();
}

export async function getTaskById(taskId: string, repository: ITasksRepository): Promise<CrmTask | null> {
  'use server';
  const service = await createTasksService(repository);
  return service.getTaskById(taskId);
}

export async function getTasksStats(userId: string | null, repository: ITasksRepository): Promise<TasksStats> {
  'use server';
  const service = await createTasksService(repository);
  return service.getTasksStats(userId);
}
