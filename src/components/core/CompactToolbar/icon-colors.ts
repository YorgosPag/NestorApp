// CompactToolbar Icon Colors - Κεντρικοποιημένα χρώματα εικονιδίων
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

export const iconColors = {
  // Primary Actions - Κύριες ενέργειες
  newItem: HOVER_TEXT_EFFECTS.GREEN,
  editItem: HOVER_TEXT_EFFECTS.BLUE,
  deleteItems: HOVER_TEXT_EFFECTS.RED,

  // Visibility Actions - Ορατότητα (Eye/EyeOff icons)
  visibilityOn: HOVER_TEXT_EFFECTS.GREEN,    // 👁️ Visible state - πράσινο
  visibilityOff: HOVER_TEXT_EFFECTS.GRAY,    // 👁️‍🗨️ Hidden state - γκρι

  // Filters & Search - Φίλτρα και αναζήτηση
  filters: HOVER_TEXT_EFFECTS.PURPLE,
  sorting: HOVER_TEXT_EFFECTS.INDIGO,

  // Favorites & Archive - Αγαπημένα και αρχείο
  favorites: HOVER_TEXT_EFFECTS.YELLOW,
  archive: HOVER_TEXT_EFFECTS.GRAY,

  // Import/Export - Εισαγωγή/Εξαγωγή
  export: HOVER_TEXT_EFFECTS.EMERALD,
  import: HOVER_TEXT_EFFECTS.TEAL,

  // System Actions - Συστημικές ενέργειες
  refresh: HOVER_TEXT_EFFECTS.CYAN,
  preview: HOVER_TEXT_EFFECTS.ORANGE,

  // Communication - Επικοινωνία
  copy: HOVER_TEXT_EFFECTS.SLATE,
  share: HOVER_TEXT_EFFECTS.PINK,

  // Management - Διαχείριση
  reports: HOVER_TEXT_EFFECTS.AMBER,
  settings: HOVER_TEXT_EFFECTS.VIOLET,
  favoritesManagement: HOVER_TEXT_EFFECTS.ROSE,
  help: HOVER_TEXT_EFFECTS.SKY
} as const;

// Icon color getter function
export const getIconColor = (actionType: keyof typeof iconColors): string => {
  return iconColors[actionType] || HOVER_TEXT_EFFECTS.GRAY;
};