'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, Home, Building, Layers, MapPin } from 'lucide-react';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '../../ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface Item {
  id: string;
  name: string;
  [key: string]: any;
}

interface SelectItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemSelected: (item: Item) => void;
  items: Item[];
  title: string;
  description: string;
  searchPlaceholder: string;
  itemType: 'project' | 'building' | 'floor' | 'unit';
  isLoading?: boolean;
}

const getIcon = (itemType: string) => {
  switch (itemType) {
    case 'project':
      return Home;
    case 'building':
      return Building;
    case 'floor':
      return Layers;
    case 'unit':
      return MapPin;
    default:
      return Home;
  }
};

const getIconColor = (itemType: string) => {
  switch (itemType) {
    case 'project':
      return 'text-green-600';
    case 'building':
      return 'text-purple-600';
    case 'floor':
      return 'text-orange-600';
    case 'unit':
      return 'text-teal-600';
    default:
      return 'text-blue-600';
  }
};

export function SelectItemModal({
  open,
  onOpenChange,
  onItemSelected,
  items,
  title,
  description,
  searchPlaceholder,
  itemType,
  isLoading = false,
}: SelectItemModalProps) {
  const iconSizes = useIconSizes();
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const Icon = getIcon(itemType);
  const iconColor = getIconColor(itemType);

  // Φιλτράρισμα based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredItems(items);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = items.filter(item =>
        item.name.toLowerCase().includes(searchLower)
      );
      setFilteredItems(filtered);
    }
  }, [searchTerm, items]);

  const handleSelectItem = (item: Item) => {
    onItemSelected(item);
    onOpenChange(false);
    setSearchTerm('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setSearchTerm('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`${iconSizes.md} ${iconColor}`} />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className={`absolute left-3 top-3 ${iconSizes.sm} text-gray-400`} />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className={`${iconSizes.lg} animate-spin text-blue-600`} />
              <span className="ml-2 text-sm text-gray-600">Φόρτωση...</span>
            </div>
          )}

          {/* Items List */}
          {!isLoading && (
            <ScrollArea className="h-[400px] w-full">
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {items.length === 0 ? (
                    <div>
                      <Icon className={`${iconSizes.xl} mx-auto mb-3 text-gray-300`} />
                      <p>Δεν βρέθηκαν διαθέσιμα στοιχεία.</p>
                    </div>
                  ) : (
                    <div>
                      <Search className={`${iconSizes.xl} mx-auto mb-3 text-gray-300`} />
                      <p>Δεν βρέθηκαν στοιχεία για "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className={`flex items-center gap-3 p-3 ${useBorderTokens().quick.card} cursor-pointer ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                    >
                      <Icon className={`${iconSizes.md} ${iconColor} flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-foreground truncate">
                          {item.name}
                        </div>
                        {item.subtitle && (
                          <div className="text-sm text-gray-500 dark:text-muted-foreground">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 flex-shrink-0">
                        Επιλογή →
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Ακύρωση
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SelectItemModal;