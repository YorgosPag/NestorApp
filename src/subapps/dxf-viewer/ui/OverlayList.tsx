'use client';
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { CommonBadge } from '../../../core/badges';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Input } from '../../../components/ui/input';
import { Eye, EyeOff, Edit3, Trash2, Search } from 'lucide-react';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { STATUS_COLORS, STATUS_LABELS, KIND_LABELS, type Overlay } from '../overlays/types';
import { getSemanticIntent } from '../config/status-semantic';
import { getSemanticBgClass } from '../ui-adapters/semantic-bg-adapter';
import type { PropertyStatus } from '../../../constants/property-statuses-enterprise';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../config/panel-tokens';

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
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenOverlays, setHiddenOverlays] = useState<Set<string>>(new Set());
  const selectedCardRef = React.useRef<HTMLDivElement>(null);

  // 🏢 ENTERPRISE: Clean semantic pipeline - PropertyStatus → SemanticIntent → CSS class
  const getOverlayBgClass = (status: PropertyStatus) => {
    const semanticIntent = getSemanticIntent(status);
    return getSemanticBgClass(semanticIntent, colors);
  };

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
    const status = STATUS_LABELS[overlay.status || 'for-sale'].toLowerCase();
    const kind = KIND_LABELS[overlay.kind].toLowerCase();
    return label.includes(query) || status.includes(query) || kind.includes(query);
  });

  const handleToggleVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHiddenOverlays = new Set(hiddenOverlays);
    if (newHiddenOverlays.has(id)) {
      newHiddenOverlays.delete(id);
    } else {
      newHiddenOverlays.add(id);
    }
    setHiddenOverlays(newHiddenOverlays);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Διαγραφή overlay;')) {
      onDelete(id);
      if (selectedOverlayId === id) onSelect(null);
    }
  };

  const handleEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(id);
  };

  return (
    <Card className={`w-full h-full flex flex-col ${colors.bg.secondary} ${getStatusBorder('default')} ${colors.text.primary}`}>
      <CardHeader className={`${PANEL_LAYOUT.PADDING.BOTTOM_SM} ${PANEL_LAYOUT.PADDING.TOP_SM} ${PANEL_LAYOUT.SPACING.HORIZONTAL_SM}`}>
        <div className="flex items-center justify-between">
          <CardTitle className={PANEL_LAYOUT.TYPOGRAPHY.SM}>Overlays</CardTitle>
          <CommonBadge
            status="company"
            customLabel={overlays.length.toString()}
            variant="secondary"
            className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.hover} ${colors.text.tertiary}`}
          />
        </div>

        <div className={`relative ${PANEL_LAYOUT.MARGIN.TOP_SM}`}>
          <Search className={`absolute ${PANEL_LAYOUT.POSITION.LEFT_2} ${PANEL_LAYOUT.POSITION.TOP_2_5} ${iconSizes.sm} ${colors.text.muted}`} />
          <Input
            placeholder="Αναζήτηση..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${PANEL_LAYOUT.PADDING.LEFT_XL} ${iconSizes.xl} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.bg.primary} ${quick.input} ${colors.text.primary} placeholder:${colors.text.muted}`}
          />
        </div>
      </CardHeader>
      
      <CardContent className={`${PANEL_LAYOUT.SPACING.NONE} flex-1 min-h-0`}>
        <ScrollArea className="h-full">
          <div className={`${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
            {filteredOverlays.length === 0 ? (
              <div className={`text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL}`}>
                <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>
                  {searchQuery ? 'Δεν βρέθηκαν overlays' : 'Δεν υπάρχουν overlays'}
                </p>
              </div>
            ) : (
              filteredOverlays.map(overlay => {
                const isSelected = selectedOverlayId === overlay.id;
                const isVisible = !hiddenOverlays.has(overlay.id);
                
                return (
                  <article
                    key={overlay.id}
                    ref={isSelected ? selectedCardRef : null}
                    className={`flex items-center ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.CURSOR.POINTER} ${PANEL_LAYOUT.WIDTH.FULL} ${PANEL_LAYOUT.OVERFLOW.HIDDEN} ${
                      isSelected ? `${colors.bg.info}/50 ${getStatusBorder('info')}` : `${colors.bg.primary}/50 ${quick.card} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
                    }`}
                    onClick={() => onSelect(overlay.id === selectedOverlayId ? null : overlay.id)}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleToggleVisibility(overlay.id, e)}
                      className={`${PANEL_LAYOUT.SPACING.HALF} ${iconSizes.md} ${colors.text.muted}${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
                    >
                      {isVisible ? <Eye className={iconSizes.xs} /> : <EyeOff className={`${iconSizes.xs} ${PANEL_LAYOUT.OPACITY['50']}`} />}
                    </Button>

                    <div
                      className={`${iconSizes.xs} rounded ${quick.button} flex-shrink-0 ${(() => {
                        const status: PropertyStatus = overlay.status ?? 'for-sale';
                        return getOverlayBgClass(status);
                      })()}`}
                    />
                    <div className={`flex-1 ${PANEL_LAYOUT.MIN_WIDTH['0']} ${PANEL_LAYOUT.OVERFLOW.HIDDEN}`}>
                      <div className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} truncate`}>
                        {STATUS_LABELS[overlay.status || 'for-sale']} {KIND_LABELS[overlay.kind]}
                      </div>
                      <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} truncate`}>
                        {overlay.label || `Overlay ${overlay.id.slice(0, 6)}`}
                      </div>
                    </div>
                    <nav className={`flex items-center ${PANEL_LAYOUT.GAP.HALF} flex-shrink-0`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleEdit(overlay.id, e)}
                        className={`${PANEL_LAYOUT.SPACING.HALF} ${iconSizes.md} ${colors.text.muted}${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`}
                        title="Επεξεργασία"
                      >
                        <Edit3 className={iconSizes.xs} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDelete(overlay.id, e)}
                        className={`${PANEL_LAYOUT.SPACING.HALF} ${iconSizes.md} ${HOVER_TEXT_EFFECTS.RED}`}
                        title="Διαγραφή"
                      >
                        <Trash2 className={iconSizes.xs} />
                      </Button>
                    </nav>
                  </article>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
