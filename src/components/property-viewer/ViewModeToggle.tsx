'use client';
import { Grid, List } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export function ViewModeToggle({ value, onChange }: { value: 'grid'|'list'; onChange: (v:'grid'|'list')=>void; }) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <div className={`flex ${colors.bg.secondary} rounded-lg p-1`}>
      <button
        onClick={() => onChange('grid')}
        className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
          value === 'grid' ? `${colors.bg.primary} shadow-sm ${colors.text.info}` : colors.text.muted
        }`}
      >
        <Grid className={iconSizes.sm} />
        <span className="text-sm font-medium">Πλέγμα</span>
      </button>
      <button
        onClick={() => onChange('list')}
        className={`px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
          value === 'list' ? `${colors.bg.primary} shadow-sm ${colors.text.info}` : colors.text.muted
        }`}
      >
        <List className={iconSizes.sm} />
        <span className="text-sm font-medium">Λίστα</span>
      </button>
    </div>
  );
}