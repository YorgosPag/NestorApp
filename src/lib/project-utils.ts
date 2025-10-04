'use client';

import type { ProjectStatus } from '@/types/project';

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('el-GR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

export const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

export const getProgressColor = (progress: number) => {
    if (progress < 25) return 'text-red-500';
    if (progress < 50) return 'text-yellow-500';
    if (progress >= 75) return 'text-green-500';
    return 'text-blue-500';
};

export const getDaysUntilCompletion = (completionDate?: string) => {
    if (!completionDate) return null;
    const today = new Date();
    const completion = new Date(completionDate);
    const diffTime = completion.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
};

export const STATUS_COLORS: Record<string, string> = {
    'planning': 'bg-yellow-100 text-yellow-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'on_hold': 'bg-gray-100 text-gray-800',
    'cancelled': 'bg-red-100 text-red-800',
    'for-sale': 'bg-green-100 text-green-800',
    'sold': 'bg-red-100 text-red-800',
    'for-rent': 'bg-blue-100 text-blue-800',
    'rented': 'bg-orange-100 text-orange-800',
    'reserved': 'bg-yellow-100 text-yellow-800',
    'default': 'bg-gray-100 text-gray-800',
};
  
export const STATUS_LABELS: Record<string, string> = {
    'planning': 'Σχεδιασμός',
    'in_progress': 'Σε εξέλιξη',
    'completed': 'Ολοκληρωμένο',
    'on_hold': 'Σε αναμονή',
    'cancelled': 'Ακυρωμένο',
    'for-sale': 'Προς Πώληση',
    'sold': 'Πουλημένο',
    'for-rent': 'Προς Ενοικίαση',
    'rented': 'Ενοικιασμένο',
    'reserved': 'Κρατημένο',
    'default': 'Άγνωστο',
};

export const getStatusColor = (status?: string) => {
    return STATUS_COLORS[status || 'default'];
};
  
export const getStatusLabel = (status?: string) => {
    return STATUS_LABELS[status || 'default'];
};

export const getProjectLabel = (status?: string): string => {
    return STATUS_LABELS[status as ProjectStatus] ?? (status || '—');
}
