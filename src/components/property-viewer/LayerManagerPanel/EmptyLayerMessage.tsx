'use client';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

interface EmptyLayerMessageProps {
  searchQuery: string;
}

export function EmptyLayerMessage({ searchQuery }: EmptyLayerMessageProps) {
  const iconSizes = useIconSizes();
  return (
    <div className="text-center py-8 text-muted-foreground">
      <UnitIcon className={`${iconSizes.xl} mx-auto mb-2 ${unitColor}`} />
      <p className="text-sm">Δεν βρέθηκαν layers</p>
      {searchQuery ? (
        <p className="text-xs mt-1 italic">
          Δεν βρέθηκαν αποτελέσματα για "{searchQuery}"
        </p>
      ) : (
        <p className="text-xs">Δοκιμάστε να αλλάξετε τα φίλτρα</p>
      )}
    </div>
  );
}
