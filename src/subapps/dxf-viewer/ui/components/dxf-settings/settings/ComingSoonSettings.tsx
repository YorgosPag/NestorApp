import React from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export const ComingSoonSettings: React.FC = () => {
  const colors = useSemanticColors();

  return (
    <div className={`p-4 text-center ${colors.text.muted}`}>
      <div className="text-2xl mb-2">🚧</div>
      <div className="text-sm">Σύντομα διαθέσιμο...</div>
    </div>
  );
};