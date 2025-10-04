import type { CrmTask } from '@/types/crm';
import type { ITasksService, ITasksRepository } from '../contracts';
import { Timestamp, serverTimestamp } from 'firebase/firestore';

let tasksServiceInstance: TasksService | null = null;

class TasksService implements ITasksService {
  constructor(private repository: ITasksRepository) {}

  async addTask(taskData: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>): Promise<{ id: string; success: boolean; }> {
    try {
      const { id } = await this.repository.add(taskData);
      return { id, success: true };
    } catch (error) {
      console.error('Σφάλμα κατά την προσθήκη εργασίας:', error);
      throw error;
    }
  }

  async getAllTasks(): Promise<CrmTask[]> {
    try {
      return await this.repository.getAll();
    } catch (error) {
      console.error('Σφάλμα κατά την ανάκτηση εργασιών:', error);
      throw error;
    }
  }

  async getTasksByUser(userId: string): Promise<CrmTask[]> {
    try {
      return await this.repository.getByUser(userId);
    } catch (error) {
      console.error('Σφάλμα κατά την ανάκτηση εργασιών χρήστη:', error);
      throw error;
    }
  }

  async getTasksByLead(leadId: string): Promise<CrmTask[]> {
    try {
      return await this.repository.getByLead(leadId);
    } catch (error) {
      console.error('Σφάλμα κατά την ανάκτηση εργασιών lead:', error);
      throw error;
    }
  }

  async getTasksByStatus(status: CrmTask['status']): Promise<CrmTask[]> {
    try {
      return await this.repository.getByStatus(status);
    } catch (error) {
      console.error('Σφάλμα κατά το φιλτράρισμα εργασιών:', error);
      throw error;
    }
  }

  async getOverdueTasks(): Promise<CrmTask[]> {
    try {
      return await this.repository.getOverdue();
    } catch (error) {
      console.error('Σφάλμα κατά την ανάκτηση εκπρόθεσμων εργασιών:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<CrmTask>): Promise<{ success: boolean; }> {
    try {
      await this.repository.update(taskId, updates);
      return { success: true };
    } catch (error) {
      console.error('Σφάλμα κατά την ενημέρωση εργασίας:', error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<{ success: boolean; }> {
    try {
      await this.repository.delete(taskId);
      return { success: true };
    } catch (error) {
      console.error('Σφάλμα κατά τη διαγραφή εργασίας:', error);
      throw error;
    }
  }

  async deleteAllTasks(): Promise<{ success: boolean; deletedCount: number; }> {
    try {
      const deletedCount = await this.repository.deleteAll();
      return { success: true, deletedCount };
    } catch (error) {
      console.error('Σφάλμα κατά τη μαζική διαγραφή εργασιών:', error);
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
      console.error('Σφάλμα κατά την ολοκλήρωση εργασίας:', error);
      throw error;
    }
  }

  async getTasksStats(userId: string | null = null) {
    try {
      return await this.repository.getStats(userId);
    } catch (error) {
      console.error('Σφάλμα κατά την ανάκτηση στατιστικών εργασιών:', error);
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
