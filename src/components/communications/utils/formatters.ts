import { Mail, Phone, MessageSquare, Send, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/intl-utils';

export const getTypeIcon = (type: string) => ({
  email: Mail, sms: MessageSquare, call: Phone, whatsapp: MessageSquare, telegram: Send,
}[type] || Mail);

export const getTypeColor = (type: string) => ({
  email: 'text-blue-600 bg-blue-100',
  sms: 'text-green-600 bg-green-100',
  call: 'text-purple-600 bg-purple-100',
  whatsapp: 'text-green-600 bg-green-100',
  telegram: 'text-blue-600 bg-blue-100',
}[type] || 'text-slate-600 bg-slate-100');

export const getStatusIcon = (status: string) => ({
  sent: CheckCircle, delivered: CheckCircle, completed: CheckCircle, failed: XCircle, pending: Clock,
}[status] || AlertCircle);

export const getStatusColor = (status: string) => ({
  sent: 'text-green-600',
  delivered: 'text-green-600',
  completed: 'text-green-600',
  failed: 'text-red-600',
  pending: 'text-yellow-600',
}[status] || 'text-gray-600');

export const getDirectionLabel = (direction: string) =>
  direction === 'inbound' ? 'Εισερχόμενο' : 'Εξερχόμενο';


export const getRelativeTime = (timestamp: Date | string | number | { toDate?: () => Date } | null | undefined) => {
  if (!timestamp) return '';
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if(isNaN(date.getTime())) return '';
    const now = new Date();
    const diffInMinutes = Math.floor((+now - +date) / (1000 * 60));
    if (diffInMinutes < 1) return 'Μόλις τώρα';
    if (diffInMinutes < 60) return `${diffInMinutes} λεπτά πριν`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ώρες πριν`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} μέρες πριν`;
    return formatDateTime(timestamp);
  } catch {
    return '';
  }
};
