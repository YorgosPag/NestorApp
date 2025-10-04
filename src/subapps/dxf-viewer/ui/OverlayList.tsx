'use client';
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Input } from '../../../components/ui/input';
import { Eye, EyeOff, Edit3, Trash2, Search } from 'lucide-react';
import { STATUS_COLORS, STATUS_LABELS, KIND_LABELS, type Overlay } from '../overlays/types';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenOverlays, setHiddenOverlays] = useState<Set<string>>(new Set());
  const selectedCardRef = React.useRef<HTMLDivElement>(null);

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
    <Card className="w-full h-full flex flex-col bg-gray-800 border-gray-700 text-white">
      <CardHeader className="pb-2 pt-3 px-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Overlays</CardTitle>
          <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-300">{overlays.length}</Badge>
        </div>
        
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Αναζήτηση..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm bg-gray-900 border-gray-600 text-white placeholder-gray-400"
          />
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="px-2 py-2 space-y-2">
            {filteredOverlays.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">
                  {searchQuery ? 'Δεν βρέθηκαν overlays' : 'Δεν υπάρχουν overlays'}
                </p>
              </div>
            ) : (
              filteredOverlays.map(overlay => {
                const isSelected = selectedOverlayId === overlay.id;
                const isVisible = !hiddenOverlays.has(overlay.id);
                
                return (
                  <div
                    key={overlay.id}
                    ref={isSelected ? selectedCardRef : null}
                    className={`flex items-center gap-1 px-2 py-2 rounded border transition-colors cursor-pointer w-full overflow-hidden ${
                      isSelected ? 'bg-blue-900/50 border-blue-500' : 'bg-gray-900/50 border-gray-600 hover:bg-gray-700'
                    }`}
                    onClick={() => onSelect(overlay.id === selectedOverlayId ? null : overlay.id)}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleToggleVisibility(overlay.id, e)}
                      className="p-0.5 h-5 w-5 text-gray-400 hover:text-white"
                    >
                      {isVisible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 opacity-50" />}
                    </Button>

                    <div
                      className="w-3 h-3 rounded border flex-shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[overlay.status || 'for-sale'] }}
                    />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="text-sm font-medium truncate">
                        {STATUS_LABELS[overlay.status || 'for-sale']} {KIND_LABELS[overlay.kind]}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {overlay.label || `Overlay ${overlay.id.slice(0, 6)}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleEdit(overlay.id, e)}
                        className="p-0.5 h-5 w-5 text-gray-400 hover:text-white"
                        title="Επεξεργασία"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDelete(overlay.id, e)}
                        className="p-0.5 h-5 w-5 text-red-400 hover:text-red-300"
                        title="Διαγραφή"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
