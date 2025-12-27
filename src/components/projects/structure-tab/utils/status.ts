import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export const getStatusColor = (status: string, colors?: ReturnType<typeof useSemanticColors>) => {
  if (!colors) {
    // Enterprise fallback
    switch (status) {
      case "sold": return "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400";
      case "reserved": return "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "for-sale": return "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400";
      case "for-rent": return "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400";
      case "rented": return "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400";
      default: return "text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-300";
    }
  }

  switch (status) {
    case "sold": return `${colors.text.success} ${colors.bg.successSubtle}`;
    case "reserved": return `${colors.text.warning} ${colors.bg.warningSubtle}`;
    case "for-sale": return `${colors.text.info} ${colors.bg.infoSubtle}`;
    case "for-rent": return `${colors.text.accent} ${colors.bg.accentSubtle}`;
    case "rented": return `${colors.text.accent} ${colors.bg.accentSubtle}`;
    default: return `${colors.text.muted} ${colors.bg.muted}`;
  }
};

