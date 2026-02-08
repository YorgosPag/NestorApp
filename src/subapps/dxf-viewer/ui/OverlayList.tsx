// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
// 🏢 ENTERPRISE: Refactored to use OverlayListCard - 2026-01-25
'use client';
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle } from '../../../components/ui/card';
import { CommonBadge } from '../../../core/badges';
import { ScrollArea } from '../../../components/ui/scroll-area';
// 🏢 ENTERPRISE: Centralized SearchInput (same as UnitsList/CompactToolbar)
import { SearchInput } from '@/components/ui/search';
import { STATUS_LABELS, KIND_LABELS, type Overlay } from '../overlays/types';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../config/panel-tokens';
// 🏢 ENTERPRISE: Centralized spacing tokens (same as UnitsList)
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';
// 🏢 ENTERPRISE: Centralized OverlayListCard from domain cards
import { OverlayListCard } from '@/domain/cards';

interface OverlayListProps {
  overlays: Overlay[];
  selectedOverlayId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleLayers?: () => void;
}

export const OverlayList: React.FC<OverlayListProps> = ({
  overlays,
  selectedOverlayId,
  onSelect,
  onEdit,
  onDelete,
  onToggleLayers,
}) => {
  const { t } = useTranslation('dxf-viewer');
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: Centralized spacing (same pattern as UnitsList)
  const spacing = useSpacingTokens();
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenOverlays, setHiddenOverlays] = useState<Set<string>>(new Set());
  const selectedCardRef = React.useRef<HTMLElement>(null);

  // Auto-scroll to selected overlay card when selection changes
  React.useEffect(() => {
    if (selectedOverlayId && selectedCardRef.current) {
      selectedCardRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [selectedOverlayId]);

  const filteredOverlays = overlays.filter(overlay => {
    const query = searchQuery.toLowerCase();
    const label = overlay.label?.toLowerCase() || '';
    const status = t(STATUS_LABELS[overlay.status || 'for-sale']).toLowerCase();
    const kind = t(KIND_LABELS[overlay.kind]).toLowerCase();
    return label.includes(query) || status.includes(query) || kind.includes(query);
  });

  // 🏢 ENTERPRISE: Handler wrappers for OverlayListCard
  const handleToggleVisibility = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const newHiddenOverlays = new Set(hiddenOverlays);
    if (newHiddenOverlays.has(id)) {
      newHiddenOverlays.delete(id);
    } else {
      newHiddenOverlays.add(id);
    }
    setHiddenOverlays(newHiddenOverlays);
  };

  const handleDelete = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('overlayList.deleteConfirm'))) {
      onDelete(id);
      if (selectedOverlayId === id) onSelect(null);
    }
  };

  const handleEdit = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(id);
  };

  const handleSelect = (id: string) => () => {
    onSelect(id === selectedOverlayId ? null : id);
  };

  // 🏢 ENTERPRISE: bg.card for consistency with ListCard backgrounds
  return (
    <Card className={`w-full h-full flex flex-col ${colors.bg.card} ${getStatusBorder('default')} ${colors.text.primary}`}>
      <CardHeader className={`${PANEL_LAYOUT.PADDING.BOTTOM_SM} ${PANEL_LAYOUT.PADDING.TOP_SM} ${PANEL_LAYOUT.SPACING.HORIZONTAL_SM}`}>
        <div className="flex items-center justify-between">
          <CardTitle className={PANEL_LAYOUT.TYPOGRAPHY.SM}>{t('overlayList.title')}</CardTitle>
          <CommonBadge
            status="company"
            customLabel={overlays.length.toString()}
            variant="secondary"
            className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.hover} ${colors.text.tertiary}`}
          />
        </div>

        {/* 🏢 ENTERPRISE: Centralized SearchInput (same as UnitsList/CompactToolbar) */}
        <div className={PANEL_LAYOUT.MARGIN.TOP_SM}>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('overlayList.search')}
          />
        </div>
      </CardHeader>

      {/* 🏢 ENTERPRISE: Same pattern as UnitsList - flex-1 min-h-0 for scroll */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {/* 🏢 ENTERPRISE: Identical spacing to UnitsList (p-2 space-y-2) */}
          <div className={`${spacing.padding.sm} ${spacing.spaceBetween.sm}`}>
            {filteredOverlays.length === 0 ? (
              <div className={`text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL}`}>
                <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>
                  {searchQuery ? t('overlayList.notFound') : t('overlayList.empty')}
                </p>
              </div>
            ) : (
              filteredOverlays.map(overlay => {
                const isSelected = selectedOverlayId === overlay.id;
                const isVisible = !hiddenOverlays.has(overlay.id);

                return (
                  <OverlayListCard
                    key={overlay.id}
                    ref={isSelected ? selectedCardRef : null}
                    overlay={overlay}
                    isSelected={isSelected}
                    isVisible={isVisible}
                    onSelect={handleSelect(overlay.id)}
                    onToggleVisibility={handleToggleVisibility(overlay.id)}
                    onEdit={handleEdit(overlay.id)}
                    onDelete={handleDelete(overlay.id)}
                    compact
                  />
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
};

