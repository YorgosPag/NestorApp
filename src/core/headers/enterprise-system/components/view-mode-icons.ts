/**
 * @fileoverview **Το ΕΝΑ εικονίδιο ανά όψη** της κεφαλίδας — κοινό στο desktop και στο mobile κουμπί.
 * @module core/headers/enterprise-system/components/view-mode-icons
 *
 * Ήταν δύο χειρόγραφοι χάρτες (`HeaderViewToggle` · `MobileHeaderViewToggle`) με εφεδρεία `|| List`: νέα όψη χωρίς
 * εικονίδιο θα έβγαινε **σιωπηλά** ως «λίστα». Τώρα είναι `Record<ViewMode, …>` — νέα τιμή στο `ViewMode` ζητά
 * εικονίδιο από τον compiler (ADR-840 Σ3, όταν προστέθηκε η «κάτοψη»).
 */

import { BarChart3, Filter, LayoutGrid, List, MapPin, type LucideIcon } from 'lucide-react';
import type { ViewMode } from '../types';

export const VIEW_MODE_ICON_COMPONENTS: Readonly<Record<ViewMode, LucideIcon>> = {
  list: List,
  grid: LayoutGrid,
  // ADR-840 Σ3 — ίδιο εικονίδιο με το παλιό κουμπί «Προβολή Κάτοψης», ώστε ο άνθρωπος να το αναγνωρίζει.
  floorplan: MapPin,
  byType: Filter,
  byStatus: BarChart3,
};
