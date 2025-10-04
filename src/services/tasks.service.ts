
// This file now acts as a barrel file to re-export from the new refactored structure,
// ensuring that no other part of the application needs to change its import paths.
// This maintains the public API and avoids breaking changes.
export { 
    addTask,
    getAllTasks,
    getTasksByUser,
    getTasksByLead,
    getTasksByStatus,
    getOverdueTasks,
    updateTask,
    deleteTask,
    deleteAllTasks,
    completeTask,
    getTasksStats
} from './crm/tasks/index.server';
