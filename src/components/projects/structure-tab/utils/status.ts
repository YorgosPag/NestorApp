import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export const getStatusColor = (status: string, colors?: ReturnType<typeof useSemanticColors>) => {
  if (!colors) {
    // ✅ ENTERPRISE: CSS Variables fallback - NO HARDCODED LIGHT BACKGROUNDS!
    switch (status) {
      case "sold": return "text-green-600 bg-[hsl(var(--bg-success))] dark:bg-green-900/20 dark:text-green-400";
      case "reserved": return "text-yellow-600 bg-[hsl(var(--bg-warning))] dark:bg-yellow-900/20 dark:text-yellow-400";
      case "for-sale": return "text-blue-600 bg-[hsl(var(--bg-info))] dark:bg-blue-900/20 dark:text-blue-400";
      case "for-rent": return "text-purple-600 bg-[hsl(var(--bg-info))] dark:bg-purple-900/20 dark:text-purple-400";
      case "rented": return "text-indigo-600 bg-[hsl(var(--bg-info))] dark:bg-indigo-900/20 dark:text-indigo-400";
      default: return "text-slate-600 bg-[hsl(var(--bg-secondary))] dark:bg-slate-800 dark:text-slate-300";
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

