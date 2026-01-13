/**
 * =============================================================================
 * TASKS SERVICE - CRM TASK MANAGEMENT
 * =============================================================================
 *
 * Enterprise Pattern: Client-side Firestore operations for CRM tasks
 * Uses the real TasksRepository with Firestore integration
 *
 * @module services/tasks.service
 * @enterprise ADR-026 - CRM Tasks Backend Fix (2026-01-13)
 *
 * 🔧 FIX: Previously used placeholder SampleTasksRepository returning empty arrays
 * ✅ NOW: Uses real TasksRepository with Firestore connection
 */

'use client';

import type { CrmTask } from '@/types/crm';
import { TasksRepository } from './crm/tasks/repositories/TasksRepository';

// 🏢 ENTERPRISE: Singleton repository instance
const tasksRepository = new TasksRepository();

/**
 * Add a new task to Firestore
 */
export async function addTask(
  taskData: Omit<CrmTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'reminderSent'>
): Promise<string> {
  const result = await tasksRepository.add(taskData);
  return result.id;
}

/**
 * Get all tasks from Firestore
 */
export async function getAllTasks(): Promise<CrmTask[]> {
  return tasksRepository.getAll();
}

/**
 * Get tasks assigned to a specific user
 */
export async function getTasksByUser(userId: string): Promise<CrmTask[]> {
  return tasksRepository.getByUser(userId);
}

/**
 * Get tasks associated with a specific lead
 */
export async function getTasksByLead(leadId: string): Promise<CrmTask[]> {
  return tasksRepository.getByLead(leadId);
}

/**
 * Get tasks by status
 */
export async function getTasksByStatus(status: CrmTask['status']): Promise<CrmTask[]> {
  return tasksRepository.getByStatus(status);
}

/**
 * Get overdue tasks
 */
export async function getOverdueTasks(): Promise<CrmTask[]> {
  return tasksRepository.getOverdue();
}

/**
 * Update an existing task
 */
export async function updateTask(id: string, updates: Partial<CrmTask>): Promise<void> {
  return tasksRepository.update(id, updates);
}

/**
 * Delete a task
 */
export async function deleteTask(id: string): Promise<void> {
  return tasksRepository.delete(id);
}

/**
 * Delete all tasks
 */
export async function deleteAllTasks(): Promise<void> {
  await tasksRepository.deleteAll();
}

/**
 * Complete a task with optional notes
 */
export async function completeTask(id: string, notes = ''): Promise<void> {
  await tasksRepository.update(id, {
    status: 'completed',
    ...(notes && { 'metadata.completionNotes': notes } as Partial<CrmTask>)
  });
}

/**
 * Get task statistics
 */
export async function getTasksStats(userId: string | null = null) {
  return tasksRepository.getStats(userId);
}
