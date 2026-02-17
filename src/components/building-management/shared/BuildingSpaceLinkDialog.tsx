/**
 * BuildingSpaceLinkDialog — Link existing unlinked items to a building
 *
 * Shows a searchable list of unlinked items (parking/units/storage)
 * and lets the user link them to the current building via PATCH.
 *
 * Used by all building space tabs (Units, Parking, Storage).
 *
 * @module components/building-management/shared/BuildingSpaceLinkDialog
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Link2, Loader2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Spinner } from '@/components/ui/spinner';

// ============================================================================
// TYPES
// ============================================================================

/** Minimal shape of an item that can be linked */
export interface LinkableItem {
  id: string;
  /** Primary label (e.g. unit name, spot number, storage code) */
  label: string;
  /** Secondary info (e.g. type, floor, area) */
  sublabel?: string;
}

interface BuildingSpaceLinkDialogProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** Called when the dialog wants to close */
  onOpenChange: (open: boolean) => void;
  /** Dialog title (e.g. "Σύνδεση Θέσης Στάθμευσης") */
  title: string;
  /** Dialog description */
  description?: string;
  /** Async function to fetch unlinked items */
  fetchUnlinked: () => Promise<LinkableItem[]>;
  /** Async function to link a selected item to the building */
  onLink: (itemId: string) => Promise<void>;
  /** Placeholder for search input */
  searchPlaceholder?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BuildingSpaceLinkDialog({
  open,
  onOpenChange,
  title,
  description,
  fetchUnlinked,
  onLink,
  searchPlaceholder,
}: BuildingSpaceLinkDialogProps) {
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();

  const [items, setItems] = useState<LinkableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch unlinked items when dialog opens
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchUnlinked();
      setItems(result);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [fetchUnlinked]);

  useEffect(() => {
    if (open) {
      setSearchTerm('');
      loadItems();
    }
  }, [open, loadItems]);

  // Filter by search term
  const filtered = useMemo(() => {
    if (!searchTerm) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(lower) ||
        (item.sublabel || '').toLowerCase().includes(lower)
    );
  }, [items, searchTerm]);

  // Handle link action
  const handleLink = async (itemId: string) => {
    setLinkingId(itemId);
    try {
      await onLink(itemId);
      // Remove linked item from list
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      // Error handled by parent
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {/* Search */}
        <label className="relative">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${iconSizes.sm}`} />
          <Input
            placeholder={searchPlaceholder || t('spaceLink.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </label>

        {/* Content */}
        <section className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <article className="flex items-center justify-center py-8">
              <Spinner size="medium" />
            </article>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? t('spaceLink.noUnlinked')
                : t('spaceLink.noResults')}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between py-3 px-2 hover:bg-muted/50 rounded-md"
                >
                  <article className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    {item.sublabel && (
                      <p className="text-xs text-muted-foreground truncate">
                        {item.sublabel}
                      </p>
                    )}
                  </article>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-3 shrink-0"
                    onClick={() => handleLink(item.id)}
                    disabled={linkingId === item.id}
                  >
                    {linkingId === item.id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2 className="mr-1 h-3.5 w-3.5" />
                    )}
                    {t('spaceLink.link')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Footer */}
        {!loading && items.length > 0 && (
          <footer className="text-xs text-muted-foreground pt-2 border-t border-border">
            {filtered.length} / {items.length} {t('spaceLink.available')}
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}
