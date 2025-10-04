import { format } from "date-fns";
import { el } from "date-fns/locale";
import type { Opportunity } from '@/types/crm';

export const getStatusColor = (status?: Opportunity['stage']) => {
    const colors: Record<string, string> = {
      'initial_contact': 'bg-blue-100 text-blue-800',
      'qualification': 'bg-yellow-100 text-yellow-800',
      'viewing': 'bg-purple-100 text-purple-800',
      'proposal': 'bg-orange-100 text-orange-800',
      'negotiation': 'bg-teal-100 text-teal-800',
      'contract': 'bg-indigo-100 text-indigo-800',
      'closed_won': 'bg-green-100 text-green-800',
      'closed_lost': 'bg-red-100 text-red-800',
    };
    return colors[status || ''] || 'bg-gray-100 text-gray-800';
};

export const formatDate = (timestamp: any) => {
  if (!timestamp) return "Άγνωστη ημερομηνία";
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Άγνωστη ημερομηνία';
    return format(date, "dd/MM/yyyy HH:mm", { locale: el });
  } catch {
    return "Άγνωστη ημερομηνία";
  }
};
