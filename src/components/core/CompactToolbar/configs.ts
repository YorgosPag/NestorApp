// CompactToolbar Configurations for different list types

import type { CompactToolbarConfig } from './types';

// Buildings Configuration
export const buildingsToolbarConfig: CompactToolbarConfig = {
  searchPlaceholder: 'Αναζήτηση κτιρίων...',

  labels: {
    newItem: 'Νέο Κτίριο',
    editItem: 'Επεξεργασία',
    deleteItems: 'Διαγραφή',
    filters: 'Φίλτρα',
    favorites: 'Αγαπημένα',
    archive: 'Αρχειοθέτηση',
    export: 'Εξαγωγή',
    import: 'Εισαγωγή',
    refresh: 'Ανανέωση',
    preview: 'Προεπισκόπηση',
    copy: 'Αντιγραφή',
    share: 'Κοινοποίηση',
    reports: 'Αναφορές',
    settings: 'Ρυθμίσεις',
    favoritesManagement: 'Διαχείριση αγαπημένων',
    help: 'Βοήθεια',
    sorting: 'Ταξινόμηση κτιρίων'
  },

  tooltips: {
    newItem: 'Νέο Κτίριο (Ctrl+N)',
    editItem: 'Επεξεργασία επιλεγμένου',
    deleteItems: 'Διαγραφή επιλεγμένων κτιρίων',
    filters: 'Φίλτρα κτιρίων',
    favorites: 'Προσθήκη στα αγαπημένα',
    archive: 'Αρχειοθέτηση επιλεγμένων',
    export: 'Εξαγωγή δεδομένων',
    import: 'Εισαγωγή δεδομένων',
    refresh: 'Ανανέωση δεδομένων (F5)',
    preview: 'Προεπισκόπηση',
    copy: 'Αντιγραφή επιλεγμένων',
    share: 'Κοινοποίηση',
    reports: 'Δημιουργία αναφορών',
    settings: 'Ρυθμίσεις',
    favoritesManagement: 'Διαχείριση αγαπημένων',
    help: 'Βοήθεια και οδηγίες (F1)',
    sorting: 'Ταξινόμηση κτιρίων'
  },

  filterCategories: [
    {
      id: 'status',
      label: 'Κατάσταση κτιρίου',
      options: [
        { value: 'active', label: 'Ενεργά' },
        { value: 'inactive', label: 'Ανενεργά' },
        { value: 'maintenance', label: 'Συντήρηση' }
      ]
    },
    {
      id: 'type',
      label: 'Τύπος κτιρίου',
      options: [
        { value: 'residential', label: 'Οικιστικό' },
        { value: 'commercial', label: 'Επαγγελματικό' },
        { value: 'mixed', label: 'Μεικτό' }
      ]
    },
    {
      id: 'name-filters',
      label: 'Φίλτρα ονόματος',
      options: [
        { value: 'name-a-to-z', label: 'Όνομα A-Z' },
        { value: 'name-z-to-a', label: 'Όνομα Z-A' },
        { value: 'name-contains-tower', label: 'Περιέχει "Πύργο"' },
        { value: 'name-contains-complex', label: 'Περιέχει "Συγκρότημα"' }
      ]
    },
    {
      id: 'progress',
      label: 'Πρόοδος έργου',
      options: [
        { value: 'progress-0-25', label: '0-25% (Έναρξη)' },
        { value: 'progress-25-50', label: '25-50% (Εξέλιξη)' },
        { value: 'progress-50-75', label: '50-75% (Προχωρημένο)' },
        { value: 'progress-75-100', label: '75-100% (Ολοκλήρωση)' },
        { value: 'progress-completed', label: 'Ολοκληρωμένα (100%)' }
      ]
    },
    {
      id: 'value',
      label: 'Αξία έργου',
      options: [
        { value: 'value-under-1m', label: '< 1M €' },
        { value: 'value-1m-5m', label: '1M - 5M €' },
        { value: 'value-5m-10m', label: '5M - 10M €' },
        { value: 'value-10m-50m', label: '10M - 50M €' },
        { value: 'value-over-50m', label: '> 50M €' },
        { value: 'value-premium', label: 'Premium (> 100M €)' }
      ]
    },
    {
      id: 'area',
      label: 'Συνολική επιφάνεια',
      options: [
        { value: 'area-under-1k', label: '< 1.000 m²' },
        { value: 'area-1k-5k', label: '1.000 - 5.000 m²' },
        { value: 'area-5k-10k', label: '5.000 - 10.000 m²' },
        { value: 'area-10k-25k', label: '10.000 - 25.000 m²' },
        { value: 'area-25k-50k', label: '25.000 - 50.000 m²' },
        { value: 'area-over-50k', label: '> 50.000 m²' },
        { value: 'area-mega', label: 'Mega έργα (> 100.000 m²)' }
      ]
    }
  ],

  sortOptions: [
    { field: 'name', ascLabel: 'Όνομα (Α-Ζ)', descLabel: 'Όνομα (Ζ-Α)' },
    { field: 'progress', ascLabel: 'Πρόοδος (Αύξουσα)', descLabel: 'Πρόοδος (Φθίνουσα)' },
    { field: 'value', ascLabel: 'Αξία (Χαμηλή → Υψηλή)', descLabel: 'Αξία (Υψηλή → Χαμηλή)' },
    { field: 'area', ascLabel: 'Επιφάνεια (Μικρή → Μεγάλη)', descLabel: 'Επιφάνεια (Μεγάλη → Μικρή)' },
    { field: 'date', ascLabel: 'Ημερομηνία (Παλιά → Νέα)', descLabel: 'Ημερομηνία (Νέα → Παλιά)' }
  ],

  availableActions: {
    newItem: true,
    editItem: true,
    deleteItems: true,
    filters: true,
    favorites: true,
    archive: true,
    export: true,
    import: true,
    refresh: true,
    sorting: true,
    preview: true,
    copy: true,
    share: true,
    reports: true,
    settings: true,
    favoritesManagement: true,
    help: true
  }
};

// Projects Configuration
export const projectsToolbarConfig: CompactToolbarConfig = {
  searchPlaceholder: 'Αναζήτηση έργων...',

  labels: {
    newItem: 'Νέο Έργο',
    editItem: 'Επεξεργασία',
    deleteItems: 'Διαγραφή',
    filters: 'Φίλτρα',
    favorites: 'Αγαπημένα',
    archive: 'Αρχειοθέτηση',
    export: 'Εξαγωγή',
    import: 'Εισαγωγή',
    refresh: 'Ανανέωση',
    preview: 'Προεπισκόπηση',
    copy: 'Αντιγραφή',
    share: 'Κοινοποίηση',
    reports: 'Αναφορές',
    settings: 'Ρυθμίσεις',
    favoritesManagement: 'Διαχείριση αγαπημένων',
    help: 'Βοήθεια',
    sorting: 'Ταξινόμηση έργων'
  },

  tooltips: {
    newItem: 'Νέο Έργο (Ctrl+N)',
    editItem: 'Επεξεργασία επιλεγμένου έργου',
    deleteItems: 'Διαγραφή επιλεγμένων έργων',
    filters: 'Φίλτρα έργων',
    favorites: 'Προσθήκη στα αγαπημένα',
    archive: 'Αρχειοθέτηση επιλεγμένων',
    export: 'Εξαγωγή δεδομένων',
    import: 'Εισαγωγή δεδομένων',
    refresh: 'Ανανέωση δεδομένων (F5)',
    preview: 'Προεπισκόπηση έργου',
    copy: 'Αντιγραφή επιλεγμένων',
    share: 'Κοινοποίηση έργων',
    reports: 'Δημιουργία αναφορών',
    settings: 'Ρυθμίσεις',
    favoritesManagement: 'Διαχείριση αγαπημένων',
    help: 'Βοήθεια και οδηγίες (F1)',
    sorting: 'Ταξινόμηση έργων'
  },

  filterCategories: [
    {
      id: 'status',
      label: 'Κατάσταση έργου',
      options: [
        { value: 'in_progress', label: 'Σε εξέλιξη' },
        { value: 'planning', label: 'Σχεδιασμένα' },
        { value: 'completed', label: 'Ολοκληρωμένα' },
        { value: 'on_hold', label: 'Σε αναμονή' }
      ]
    },
    {
      id: 'type',
      label: 'Τύπος έργου',
      options: [
        { value: 'residential', label: 'Οικιστικό' },
        { value: 'commercial', label: 'Επαγγελματικό' },
        { value: 'infrastructure', label: 'Υποδομές' }
      ]
    }
  ],

  sortOptions: [
    { field: 'name', ascLabel: 'Όνομα (Α-Ζ)', descLabel: 'Όνομα (Ζ-Α)' },
    { field: 'progress', ascLabel: 'Πρόοδος (Αύξουσα)', descLabel: 'Πρόοδος (Φθίνουσα)' },
    { field: 'priority', ascLabel: 'Προτεραιότητα (Χαμηλή → Υψηλή)', descLabel: 'Προτεραιότητα (Υψηλή → Χαμηλή)' },
    { field: 'date', ascLabel: 'Ημερομηνία (Παλιά → Νέα)', descLabel: 'Ημερομηνία (Νέα → Παλιά)' }
  ],

  availableActions: {
    newItem: true,
    editItem: true,
    deleteItems: true,
    filters: true,
    favorites: true,
    archive: true,
    export: true,
    import: true,
    refresh: true,
    sorting: true,
    preview: true,
    copy: true,
    share: true,
    reports: true,
    settings: false, // Projects might not need settings
    favoritesManagement: true,
    help: true
  }
};

// Contacts Configuration
export const contactsToolbarConfig: CompactToolbarConfig = {
  searchPlaceholder: 'Αναζήτηση επαφών...',

  labels: {
    newItem: 'Νέα Επαφή',
    editItem: 'Επεξεργασία',
    deleteItems: 'Διαγραφή',
    filters: 'Φίλτρα',
    favorites: 'Αγαπημένες',
    archive: 'Αρχειοθέτηση',
    export: 'Εξαγωγή',
    import: 'Εισαγωγή',
    refresh: 'Ανανέωση',
    preview: 'Προεπισκόπηση',
    copy: 'Αντιγραφή',
    share: 'Κοινοποίηση',
    reports: 'Αναφορές',
    settings: 'Ρυθμίσεις',
    favoritesManagement: 'Διαχείριση αγαπημένων',
    help: 'Βοήθεια',
    sorting: 'Ταξινόμηση επαφών'
  },

  tooltips: {
    newItem: 'Νέα Επαφή (Ctrl+N)',
    editItem: 'Επεξεργασία επιλεγμένης επαφής',
    deleteItems: 'Διαγραφή επιλεγμένων επαφών',
    filters: 'Φίλτρα επαφών',
    favorites: 'Προσθήκη στις αγαπημένες',
    archive: 'Αρχειοθέτηση επιλεγμένων',
    export: 'Εξαγωγή επαφών',
    import: 'Εισαγωγή επαφών',
    refresh: 'Ανανέωση επαφών (F5)',
    preview: 'Προεπισκόπηση επαφής',
    copy: 'Αντιγραφή επιλεγμένων',
    share: 'Κοινοποίηση επαφών',
    reports: 'Δημιουργία αναφορών επαφών',
    settings: 'Ρυθμίσεις επαφών',
    favoritesManagement: 'Διαχείριση αγαπημένων',
    help: 'Βοήθεια και οδηγίες (F1)',
    sorting: 'Ταξινόμηση επαφών'
  },

  filterCategories: [
    {
      id: 'type',
      label: 'Τύπος επαφής',
      options: [
        { value: 'customer', label: 'Πελάτες' },
        { value: 'supplier', label: 'Προμηθευτές' },
        { value: 'agent', label: 'Μεσίτες' },
        { value: 'contractor', label: 'Εργολάβοι' }
      ]
    },
    {
      id: 'status',
      label: 'Κατάσταση',
      options: [
        { value: 'active', label: 'Ενεργές' },
        { value: 'inactive', label: 'Ανενεργές' },
        { value: 'archived', label: 'Αρχειοθετημένες' }
      ]
    }
  ],

  sortOptions: [
    { field: 'name', ascLabel: 'Όνομα (Α-Ζ)', descLabel: 'Όνομα (Ζ-Α)' },
    { field: 'date', ascLabel: 'Ημερομηνία (Παλιά → Νέα)', descLabel: 'Ημερομηνία (Νέα → Παλιά)' },
    { field: 'type', ascLabel: 'Τύπος (Α-Ζ)', descLabel: 'Τύπος (Ζ-Α)' }
  ],

  availableActions: {
    newItem: true,
    editItem: true,
    deleteItems: true,
    filters: true,
    favorites: true,
    archive: true,
    export: true,
    import: true,
    refresh: true,
    sorting: true,
    preview: false, // Contacts might not need preview
    copy: true,
    share: true,
    reports: true,
    settings: true,
    favoritesManagement: true,
    help: true
  }
};

// Units Configuration
export const unitsToolbarConfig: CompactToolbarConfig = {
  searchPlaceholder: 'Αναζήτηση μονάδων...',

  labels: {
    newItem: 'Νέα Μονάδα',
    editItem: 'Επεξεργασία',
    deleteItems: 'Διαγραφή',
    filters: 'Φίλτρα',
    favorites: 'Αγαπημένες',
    archive: 'Αρχειοθέτηση',
    export: 'Εξαγωγή',
    import: 'Εισαγωγή',
    refresh: 'Ανανέωση',
    preview: 'Προεπισκόπηση',
    copy: 'Αντιγραφή',
    share: 'Κοινοποίηση',
    reports: 'Αναφορές',
    settings: 'Ρυθμίσεις',
    favoritesManagement: 'Διαχείριση αγαπημένων',
    help: 'Βοήθεια',
    sorting: 'Ταξινόμηση μονάδων'
  },

  tooltips: {
    newItem: 'Νέα Μονάδα (Ctrl+N)',
    editItem: 'Επεξεργασία επιλεγμένης μονάδας',
    deleteItems: 'Διαγραφή επιλεγμένων μονάδων',
    filters: 'Φίλτρα μονάδων',
    favorites: 'Προσθήκη στις αγαπημένες',
    archive: 'Αρχειοθέτηση επιλεγμένων',
    export: 'Εξαγωγή δεδομένων',
    import: 'Εισαγωγή δεδομένων',
    refresh: 'Ανανέωση δεδομένων (F5)',
    preview: 'Προεπισκόπηση μονάδας',
    copy: 'Αντιγραφή επιλεγμένων',
    share: 'Κοινοποίηση μονάδων',
    reports: 'Δημιουργία αναφορών',
    settings: 'Ρυθμίσεις μονάδων',
    favoritesManagement: 'Διαχείριση αγαπημένων',
    help: 'Βοήθεια και οδηγίες (F1)',
    sorting: 'Ταξινόμηση μονάδων'
  },

  filterCategories: [
    {
      id: 'status',
      label: 'Κατάσταση μονάδας',
      options: [
        { value: 'available', label: 'Διαθέσιμες' },
        { value: 'sold', label: 'Πωλημένες' },
        { value: 'reserved', label: 'Κρατημένες' },
        { value: 'unavailable', label: 'Μη διαθέσιμες' }
      ]
    },
    {
      id: 'type',
      label: 'Τύπος μονάδας',
      options: [
        { value: 'apartment', label: 'Διαμέρισμα' },
        { value: 'studio', label: 'Studio' },
        { value: 'loft', label: 'Loft' },
        { value: 'penthouse', label: 'Penthouse' },
        { value: 'office', label: 'Γραφείο' },
        { value: 'shop', label: 'Κατάστημα' }
      ]
    }
  ],

  sortOptions: [
    { field: 'name', ascLabel: 'Όνομα (Α-Ζ)', descLabel: 'Όνομα (Ζ-Α)' },
    { field: 'area', ascLabel: 'Επιφάνεια (Μικρή → Μεγάλη)', descLabel: 'Επιφάνεια (Μεγάλη → Μικρή)' },
    { field: 'value', ascLabel: 'Τιμή (Χαμηλή → Υψηλή)', descLabel: 'Τιμή (Υψηλή → Χαμηλή)' },
    { field: 'status', ascLabel: 'Κατάσταση (Α-Ζ)', descLabel: 'Κατάσταση (Ζ-Α)' }
  ],

  availableActions: {
    newItem: true,
    editItem: true,
    deleteItems: true,
    filters: true,
    favorites: true,
    archive: false, // Units might not need archive
    export: true,
    import: true,
    refresh: true,
    sorting: true,
    preview: true,
    copy: true,
    share: true,
    reports: true,
    settings: true,
    favoritesManagement: true,
    help: true
  }
};