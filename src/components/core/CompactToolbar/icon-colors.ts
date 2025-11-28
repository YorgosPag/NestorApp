// CompactToolbar Icon Colors - Κεντρικοποιημένα χρώματα εικονιδίων

export const iconColors = {
  // Primary Actions - Κύριες ενέργειες
  newItem: 'text-green-600 hover:text-green-700',
  editItem: 'text-blue-600 hover:text-blue-700',
  deleteItems: 'text-red-600 hover:text-red-700',

  // Filters & Search - Φίλτρα και αναζήτηση
  filters: 'text-purple-600 hover:text-purple-700',
  sorting: 'text-indigo-600 hover:text-indigo-700',

  // Favorites & Archive - Αγαπημένα και αρχείο
  favorites: 'text-yellow-600 hover:text-yellow-700',
  archive: 'text-gray-600 hover:text-gray-700',

  // Import/Export - Εισαγωγή/Εξαγωγή
  export: 'text-emerald-600 hover:text-emerald-700',
  import: 'text-teal-600 hover:text-teal-700',

  // System Actions - Συστημικές ενέργειες
  refresh: 'text-cyan-600 hover:text-cyan-700',
  preview: 'text-orange-600 hover:text-orange-700',

  // Communication - Επικοινωνία
  copy: 'text-slate-600 hover:text-slate-700',
  share: 'text-pink-600 hover:text-pink-700',

  // Management - Διαχείριση
  reports: 'text-amber-600 hover:text-amber-700',
  settings: 'text-violet-600 hover:text-violet-700',
  favoritesManagement: 'text-rose-600 hover:text-rose-700',
  help: 'text-sky-600 hover:text-sky-700'
} as const;

// Icon color getter function
export const getIconColor = (actionType: keyof typeof iconColors): string => {
  return iconColors[actionType] || 'text-gray-600 hover:text-gray-700';
};