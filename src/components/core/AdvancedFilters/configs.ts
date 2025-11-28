'use client';

import type {
  FilterPanelConfig,
  ContactFilterState,
  UnitFilterState,
  BuildingFilterState,
  ProjectFilterState
} from './types';

// Unit Filters Configuration (μονάδες)
export const unitFiltersConfig: FilterPanelConfig = {
  title: 'Φίλτρα Αναζήτησης',
  searchPlaceholder: 'Όνομα, περιγραφή...',
  rows: [
    {
      id: 'basic-filters',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'Αναζήτηση',
          placeholder: 'Όνομα, περιγραφή...',
          width: 1,
          ariaLabel: 'Αναζήτηση με όνομα ή περιγραφή'
        },
        {
          id: 'priceRange',
          type: 'range',
          label: 'Εύρος Τιμής (€)',
          width: 1,
          ariaLabel: 'Φίλτρο εύρους τιμής'
        },
        {
          id: 'areaRange',
          type: 'range',
          label: 'Εύρος Εμβαδού (m²)',
          width: 1,
          ariaLabel: 'Φίλτρο εύρους εμβαδού'
        },
        {
          id: 'status',
          type: 'select',
          label: 'Κατάσταση',
          placeholder: 'Επιλογή κατάστασης...',
          width: 1,
          ariaLabel: 'Φίλτρο κατάστασης',
          options: [
            { value: 'all', label: 'Όλες οι καταστάσεις' },
            { value: 'for-sale', label: 'Προς Πώληση' },
            { value: 'for-rent', label: 'Προς Ενοικίαση' },
            { value: 'sold', label: 'Πωλήθηκε' },
            { value: 'rented', label: 'Ενοικιασμένο' },
            { value: 'reserved', label: 'Κρατήθηκε' },
            { value: 'withdrawn', label: 'Αποσύρθηκε' }
          ]
        }
      ]
    },
    {
      id: 'secondary-filters',
      fields: [
        {
          id: 'project',
          type: 'select',
          label: 'Έργο',
          placeholder: 'Επιλογή Έργου',
          width: 1,
          ariaLabel: 'Φίλτρο έργου',
          options: [
            { value: 'all', label: 'Όλα τα έργα' }
          ]
        },
        {
          id: 'building',
          type: 'select',
          label: 'Κτίριο',
          placeholder: 'Επιλογή Κτιρίου',
          width: 1,
          ariaLabel: 'Φίλτρο κτιρίου',
          options: [
            { value: 'all', label: 'Όλα τα κτίρια' }
          ]
        },
        {
          id: 'floor',
          type: 'select',
          label: 'Όροφος',
          placeholder: 'Επιλογή Ορόφου',
          width: 1,
          ariaLabel: 'Φίλτρο ορόφου',
          options: [
            { value: 'all', label: 'Όλοι οι όροφοι' }
          ]
        },
        {
          id: 'type',
          type: 'select',
          label: 'Τύπος Ακινήτου',
          placeholder: 'Επιλογή Τύπου',
          width: 1,
          ariaLabel: 'Φίλτρο τύπου ακινήτου',
          options: [
            { value: 'all', label: 'Όλοι οι τύποι' }
          ]
        }
      ]
    }
  ],
  advancedFilters: {
    show: true,
    title: 'Προηγμένα Φίλτρα',
    options: [
      { id: 'parking', label: 'Parking', category: 'features' },
      { id: 'storage', label: 'Αποθήκη', category: 'features' },
      { id: 'fireplace', label: 'Τζάκι', category: 'features' },
      { id: 'view', label: 'Θέα', category: 'features' },
      { id: 'pool', label: 'Πισίνα', category: 'features' }
    ],
    categories: ['features']
  }
};

// Contact Filters Configuration (επαφές)
export const contactFiltersConfig: FilterPanelConfig = {
  title: 'Φίλτρα Επαφών',
  searchPlaceholder: 'Όνομα, εταιρεία, email...',
  rows: [
    {
      id: 'contact-basic',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'Αναζήτηση',
          placeholder: 'Όνομα, εταιρεία, email...',
          width: 2,
          ariaLabel: 'Αναζήτηση επαφών'
        },
        {
          id: 'company',
          type: 'multiselect',
          label: 'Εταιρεία',
          placeholder: 'Επιλογή εταιρείας...',
          width: 1,
          options: []
        },
        {
          id: 'status',
          type: 'select',
          label: 'Κατάσταση',
          placeholder: 'Επιλογή κατάστασης...',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες οι καταστάσεις' },
            { value: 'active', label: 'Ενεργή' },
            { value: 'inactive', label: 'Ανενεργή' },
            { value: 'lead', label: 'Προοπτική' }
          ]
        }
      ]
    }
  ],
  advancedFilters: {
    show: true,
    title: 'Προηγμένα Φίλτρα',
    options: [
      { id: 'isFavorite', label: 'Αγαπημένες', category: 'status' },
      { id: 'hasEmail', label: 'Με Email', category: 'contact' },
      { id: 'hasPhone', label: 'Με Τηλέφωνο', category: 'contact' },
      { id: 'recentActivity', label: 'Πρόσφατη Δραστηριότητα', category: 'activity' }
    ],
    categories: ['status', 'contact', 'activity']
  }
};

// Building Filters Configuration (κτίρια)
export const buildingFiltersConfig: FilterPanelConfig = {
  title: 'Φίλτρα Κτιρίων',
  searchPlaceholder: 'Όνομα, περιγραφή, διεύθυνση...',
  rows: [
    {
      id: 'building-basic',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'Αναζήτηση',
          placeholder: 'Όνομα, περιγραφή, διεύθυνση...',
          ariaLabel: 'Αναζήτηση κτιρίων',
          width: 2
        },
        {
          id: 'status',
          type: 'select',
          label: 'Κατάσταση',
          placeholder: 'Επιλέξτε κατάσταση',
          ariaLabel: 'Φίλτρο κατάστασης κτιρίου',
          width: 1,
          options: [
            { value: 'all', label: 'Όλα' },
            { value: 'active', label: 'Ενεργό' },
            { value: 'inactive', label: 'Ανενεργό' },
            { value: 'pending', label: 'Εκκρεμεί' },
            { value: 'maintenance', label: 'Συντήρηση' },
            { value: 'sold', label: 'Πωλήθηκε' },
            { value: 'construction', label: 'Υπό κατασκευή' },
            { value: 'planning', label: 'Σχεδίαση' }
          ]
        },
        {
          id: 'priority',
          type: 'select',
          label: 'Προτεραιότητα',
          placeholder: 'Επιλέξτε προτεραιότητα',
          ariaLabel: 'Φίλτρο προτεραιότητας',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'high', label: 'Υψηλή' },
            { value: 'medium', label: 'Μέτρια' },
            { value: 'low', label: 'Χαμηλή' },
            { value: 'urgent', label: 'Επείγον' }
          ]
        }
      ]
    },
    {
      id: 'building-details',
      fields: [
        {
          id: 'type',
          type: 'select',
          label: 'Τύπος',
          placeholder: 'Επιλέξτε τύπο',
          ariaLabel: 'Φίλτρο τύπου κτιρίου',
          width: 1,
          options: [
            { value: 'all', label: 'Όλα' },
            { value: 'residential', label: 'Κατοικία' },
            { value: 'commercial', label: 'Εμπορικό' },
            { value: 'industrial', label: 'Βιομηχανικό' },
            { value: 'office', label: 'Γραφεία' },
            { value: 'mixed', label: 'Μικτή χρήση' },
            { value: 'warehouse', label: 'Αποθήκη' },
            { value: 'retail', label: 'Λιανικό' },
            { value: 'hotel', label: 'Ξενοδοχείο' }
          ]
        },
        {
          id: 'project',
          type: 'select',
          label: 'Έργο',
          placeholder: 'Επιλέξτε έργο',
          ariaLabel: 'Φίλτρο έργου',
          width: 1,
          options: [
            { value: 'all', label: 'Όλα' },
            { value: 'project1', label: 'Έργο Α' },
            { value: 'project2', label: 'Έργο Β' },
            { value: 'project3', label: 'Έργο Γ' }
          ]
        },
        {
          id: 'location',
          type: 'select',
          label: 'Περιοχή',
          placeholder: 'Επιλέξτε περιοχή',
          ariaLabel: 'Φίλτρο περιοχής',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'athens', label: 'Αθήνα' },
            { value: 'thessaloniki', label: 'Θεσσαλονίκη' },
            { value: 'patras', label: 'Πάτρα' },
            { value: 'heraklion', label: 'Ηράκλειο' },
            { value: 'volos', label: 'Βόλος' },
            { value: 'kavala', label: 'Καβάλα' },
            { value: 'lamia', label: 'Λαμία' }
          ]
        },
        {
          id: 'company',
          type: 'select',
          label: 'Εταιρεία',
          placeholder: 'Επιλέξτε εταιρεία',
          ariaLabel: 'Φίλτρο εταιρείας',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'company1', label: 'ΤΕΧΝΙΚΗ Α.Ε.' },
            { value: 'company2', label: 'ΔΟΜΙΚΗ Ε.Π.Ε.' },
            { value: 'company3', label: 'ΚΑΤΑΣΚΕΥΕΣ Ο.Ε.' }
          ]
        }
      ]
    },
    {
      id: 'building-ranges',
      fields: [
        {
          id: 'valueRange',
          type: 'range',
          label: 'Αξία (€)',
          ariaLabel: 'Φίλτρο εύρους αξίας',
          width: 1,
          min: 0,
          max: 10000000
        },
        {
          id: 'areaRange',
          type: 'range',
          label: 'Εμβαδόν (m²)',
          ariaLabel: 'Φίλτρο εύρους εμβαδού',
          width: 1,
          min: 0,
          max: 10000
        },
        {
          id: 'unitsRange',
          type: 'range',
          label: 'Αρ. Μονάδων',
          ariaLabel: 'Φίλτρο εύρους αριθμού μονάδων',
          width: 1,
          min: 1,
          max: 500
        },
        {
          id: 'yearRange',
          type: 'range',
          label: 'Έτος Κατασκευής',
          ariaLabel: 'Φίλτρο εύρους έτους κατασκευής',
          width: 1,
          min: 1950,
          max: 2030
        }
      ]
    },
    {
      id: 'building-features',
      fields: [
        {
          id: 'hasParking',
          type: 'checkbox',
          label: 'Parking',
          ariaLabel: 'Φίλτρο ύπαρξης parking',
          width: 1
        },
        {
          id: 'hasElevator',
          type: 'checkbox',
          label: 'Ασανσέρ',
          ariaLabel: 'Φίλτρο ύπαρξης ασανσέρ',
          width: 1
        },
        {
          id: 'hasGarden',
          type: 'checkbox',
          label: 'Κήπος',
          ariaLabel: 'Φίλτρο ύπαρξης κήπου',
          width: 1
        },
        {
          id: 'hasPool',
          type: 'checkbox',
          label: 'Πισίνα',
          ariaLabel: 'Φίλτρο ύπαρξης πισίνας',
          width: 1
        }
      ]
    },
    {
      id: 'building-advanced',
      fields: [
        {
          id: 'energyClass',
          type: 'select',
          label: 'Ενεργειακή Κλάση',
          placeholder: 'Επιλέξτε κλάση',
          ariaLabel: 'Φίλτρο ενεργειακής κλάσης',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'A+', label: 'A+' },
            { value: 'A', label: 'A' },
            { value: 'B+', label: 'B+' },
            { value: 'B', label: 'B' },
            { value: 'C', label: 'C' },
            { value: 'D', label: 'D' },
            { value: 'E', label: 'E' },
            { value: 'F', label: 'F' },
            { value: 'G', label: 'G' }
          ]
        },
        {
          id: 'accessibility',
          type: 'checkbox',
          label: 'Προσβασιμότητα ΑΜΕΑ',
          ariaLabel: 'Φίλτρο προσβασιμότητας ΑΜΕΑ',
          width: 1
        },
        {
          id: 'furnished',
          type: 'checkbox',
          label: 'Επιπλωμένο',
          ariaLabel: 'Φίλτρο επίπλωσης',
          width: 1
        },
        {
          id: 'renovation',
          type: 'select',
          label: 'Κατάσταση',
          placeholder: 'Επιλέξτε κατάσταση',
          ariaLabel: 'Φίλτρο κατάστασης ανακαίνισης',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'excellent', label: 'Άριστη' },
            { value: 'very-good', label: 'Πολύ καλή' },
            { value: 'good', label: 'Καλή' },
            { value: 'needs-renovation', label: 'Χρειάζεται ανακαίνιση' },
            { value: 'under-renovation', label: 'Υπό ανακαίνιση' }
          ]
        }
      ]
    }
  ]
};

// Project Filters Configuration (έργα)
export const projectFiltersConfig: FilterPanelConfig = {
  title: 'Φίλτρα Έργων',
  searchPlaceholder: 'Όνομα, περιγραφή, εταιρεία, τοποθεσία...',
  rows: [
    {
      id: 'project-basic',
      fields: [
        {
          id: 'searchTerm',
          type: 'search',
          label: 'Αναζήτηση',
          placeholder: 'Όνομα, περιγραφή, εταιρεία, τοποθεσία...',
          ariaLabel: 'Αναζήτηση έργων',
          width: 2
        },
        {
          id: 'status',
          type: 'select',
          label: 'Κατάσταση',
          placeholder: 'Επιλέξτε κατάσταση',
          ariaLabel: 'Φίλτρο κατάστασης έργου',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'in_progress', label: 'Σε εξέλιξη' },
            { value: 'planning', label: 'Σχεδιασμός' },
            { value: 'completed', label: 'Ολοκληρωμένα' },
            { value: 'on_hold', label: 'Σε αναμονή' },
            { value: 'cancelled', label: 'Ακυρώθηκε' },
            { value: 'delayed', label: 'Καθυστέρηση' }
          ]
        },
        {
          id: 'priority',
          type: 'select',
          label: 'Προτεραιότητα',
          placeholder: 'Επιλέξτε προτεραιότητα',
          ariaLabel: 'Φίλτρο προτεραιότητας',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'critical', label: 'Κρίσιμη' },
            { value: 'high', label: 'Υψηλή' },
            { value: 'medium', label: 'Μέτρια' },
            { value: 'low', label: 'Χαμηλή' }
          ]
        }
      ]
    },
    {
      id: 'project-details',
      fields: [
        {
          id: 'type',
          type: 'select',
          label: 'Τύπος',
          placeholder: 'Επιλέξτε τύπο',
          ariaLabel: 'Φίλτρο τύπου έργου',
          width: 1,
          options: [
            { value: 'all', label: 'Όλοι' },
            { value: 'residential', label: 'Οικιστικό' },
            { value: 'commercial', label: 'Επαγγελματικό' },
            { value: 'industrial', label: 'Βιομηχανικό' },
            { value: 'infrastructure', label: 'Υποδομές' },
            { value: 'renovation', label: 'Ανακαίνιση' },
            { value: 'mixed', label: 'Μικτό' },
            { value: 'public', label: 'Δημόσιο' }
          ]
        },
        {
          id: 'company',
          type: 'select',
          label: 'Εταιρεία',
          placeholder: 'Επιλέξτε εταιρεία',
          ariaLabel: 'Φίλτρο εταιρείας',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'company1', label: 'ΤΕΧΝΙΚΗ Α.Ε.' },
            { value: 'company2', label: 'ΔΟΜΙΚΗ Ε.Π.Ε.' },
            { value: 'company3', label: 'ΚΑΤΑΣΚΕΥΕΣ Ο.Ε.' },
            { value: 'company4', label: 'ΑΡΧΙΤΕΚΤΟΝΙΚΗ ΛΤΔ' }
          ]
        },
        {
          id: 'location',
          type: 'select',
          label: 'Περιοχή',
          placeholder: 'Επιλέξτε περιοχή',
          ariaLabel: 'Φίλτρο περιοχής',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'athens', label: 'Αθήνα' },
            { value: 'thessaloniki', label: 'Θεσσαλονίκη' },
            { value: 'patras', label: 'Πάτρα' },
            { value: 'heraklion', label: 'Ηράκλειο' },
            { value: 'volos', label: 'Βόλος' },
            { value: 'kavala', label: 'Καβάλα' },
            { value: 'lamia', label: 'Λαμία' },
            { value: 'rhodes', label: 'Ρόδος' }
          ]
        },
        {
          id: 'client',
          type: 'select',
          label: 'Πελάτης',
          placeholder: 'Επιλέξτε πελάτη',
          ariaLabel: 'Φίλτρο πελάτη',
          width: 1,
          options: [
            { value: 'all', label: 'Όλοι' },
            { value: 'client1', label: 'Δήμος Αθηναίων' },
            { value: 'client2', label: 'ΕΤΑΔ Α.Ε.' },
            { value: 'client3', label: 'Ιδιωτική Εταιρεία' },
            { value: 'client4', label: 'Κοινότητα' }
          ]
        }
      ]
    },
    {
      id: 'project-ranges',
      fields: [
        {
          id: 'budgetRange',
          type: 'range',
          label: 'Προϋπολογισμός (€)',
          ariaLabel: 'Φίλτρο εύρους προϋπολογισμού',
          width: 1,
          min: 0,
          max: 50000000
        },
        {
          id: 'durationRange',
          type: 'range',
          label: 'Διάρκεια (μήνες)',
          ariaLabel: 'Φίλτρο εύρους διάρκειας',
          width: 1,
          min: 1,
          max: 120
        },
        {
          id: 'progressRange',
          type: 'range',
          label: 'Πρόοδος (%)',
          ariaLabel: 'Φίλτρο εύρους προόδου',
          width: 1,
          min: 0,
          max: 100
        },
        {
          id: 'yearRange',
          type: 'range',
          label: 'Έτος Έναρξης',
          ariaLabel: 'Φίλτρο εύρους έτους έναρξης',
          width: 1,
          min: 2020,
          max: 2030
        }
      ]
    },
    {
      id: 'project-features',
      fields: [
        {
          id: 'hasPermits',
          type: 'checkbox',
          label: 'Έχει άδειες',
          ariaLabel: 'Φίλτρο ύπαρξης αδειών',
          width: 1
        },
        {
          id: 'hasFinancing',
          type: 'checkbox',
          label: 'Έχει χρηματοδότηση',
          ariaLabel: 'Φίλτρο ύπαρξης χρηματοδότησης',
          width: 1
        },
        {
          id: 'isEcological',
          type: 'checkbox',
          label: 'Οικολογικό',
          ariaLabel: 'Φίλτρο οικολογικών έργων',
          width: 1
        },
        {
          id: 'hasSubcontractors',
          type: 'checkbox',
          label: 'Έχει υπεργολάβους',
          ariaLabel: 'Φίλτρο ύπαρξης υπεργολάβων',
          width: 1
        }
      ]
    },
    {
      id: 'project-advanced',
      fields: [
        {
          id: 'riskLevel',
          type: 'select',
          label: 'Επίπεδο κινδύνου',
          placeholder: 'Επιλέξτε επίπεδο',
          ariaLabel: 'Φίλτρο επιπέδου κινδύνου',
          width: 1,
          options: [
            { value: 'all', label: 'Όλα' },
            { value: 'low', label: 'Χαμηλός' },
            { value: 'medium', label: 'Μέτριος' },
            { value: 'high', label: 'Υψηλός' },
            { value: 'critical', label: 'Κρίσιμος' }
          ]
        },
        {
          id: 'complexity',
          type: 'select',
          label: 'Πολυπλοκότητα',
          placeholder: 'Επιλέξτε πολυπλοκότητα',
          ariaLabel: 'Φίλτρο πολυπλοκότητας',
          width: 1,
          options: [
            { value: 'all', label: 'Όλες' },
            { value: 'simple', label: 'Απλή' },
            { value: 'medium', label: 'Μέτρια' },
            { value: 'complex', label: 'Πολύπλοκη' },
            { value: 'very_complex', label: 'Πολύ πολύπλοκη' }
          ]
        },
        {
          id: 'isActive',
          type: 'checkbox',
          label: 'Μόνο ενεργά',
          ariaLabel: 'Φίλτρο μόνο ενεργών έργων',
          width: 1
        },
        {
          id: 'hasIssues',
          type: 'checkbox',
          label: 'Έχει προβλήματα',
          ariaLabel: 'Φίλτρο έργων με προβλήματα',
          width: 1
        }
      ]
    }
  ]
};

// Default filter states
export const defaultUnitFilters: UnitFilterState = {
  searchTerm: '',
  project: [],
  building: [],
  floor: [],
  type: [],
  status: [],
  priceRange: { min: undefined, max: undefined },
  areaRange: { min: undefined, max: undefined },
  features: []
};

export const defaultContactFilters: ContactFilterState = {
  searchTerm: '',
  company: [],
  status: [],
  tags: [],
  dateRange: { from: undefined, to: undefined }
};

export const defaultBuildingFilters: BuildingFilterState = {
  searchTerm: '',
  project: [],
  status: [],
  type: [],
  location: [],
  company: [],
  priority: [],
  energyClass: [],
  renovation: [],
  ranges: {
    valueRange: { min: undefined, max: undefined },
    areaRange: { min: undefined, max: undefined },
    unitsRange: { min: undefined, max: undefined },
    yearRange: { min: undefined, max: undefined }
  },
  hasParking: false,
  hasElevator: false,
  hasGarden: false,
  hasPool: false,
  accessibility: false,
  furnished: false
};

export const defaultProjectFilters: ProjectFilterState = {
  searchTerm: '',
  status: [],
  type: [],
  company: [],
  location: [],
  client: [],
  priority: [],
  riskLevel: [],
  complexity: [],
  budgetRange: { min: undefined, max: undefined },
  durationRange: { min: undefined, max: undefined },
  progressRange: { min: undefined, max: undefined },
  yearRange: { min: undefined, max: undefined },
  dateRange: { from: undefined, to: undefined },
  hasPermits: false,
  hasFinancing: false,
  isEcological: false,
  hasSubcontractors: false,
  isActive: false,
  hasIssues: false
};