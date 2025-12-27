import type { Opportunity } from '@/types/crm';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export const getStatusColor = (status?: Opportunity['stage'], colors?: ReturnType<typeof useSemanticColors>) => {
    if (!colors) {
      // Enterprise fallback
      const fallbackColors: Record<string, string> = {
        'initial_contact': 'bg-blue-100 text-blue-800',
        'qualification': 'bg-yellow-100 text-yellow-800',
        'viewing': 'bg-purple-100 text-purple-800',
        'proposal': 'bg-orange-100 text-orange-800',
        'negotiation': 'bg-teal-100 text-teal-800',
        'contract': 'bg-indigo-100 text-indigo-800',
        'closed_won': 'bg-green-100 text-green-800',
        'closed_lost': 'bg-red-100 text-red-800',
      };
      return fallbackColors[status || ''] || 'bg-slate-100 text-slate-800';
    }

    const semanticColors: Record<string, string> = {
      'initial_contact': `${colors.bg.infoSubtle} ${colors.text.info}`,
      'qualification': `${colors.bg.warningSubtle} ${colors.text.warning}`,
      'viewing': `${colors.bg.accentSubtle} ${colors.text.accent}`,
      'proposal': `${colors.bg.warningSubtle} ${colors.text.warning}`,
      'negotiation': `${colors.bg.accentSubtle} ${colors.text.accent}`,
      'contract': `${colors.bg.accentSubtle} ${colors.text.accent}`,
      'closed_won': `${colors.bg.successSubtle} ${colors.text.success}`,
      'closed_lost': `${colors.bg.errorSubtle} ${colors.text.error}`,
    };
    return semanticColors[status || ''] || `${colors.bg.muted} ${colors.text.muted}`;
};

