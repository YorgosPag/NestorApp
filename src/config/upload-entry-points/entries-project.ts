/**
 * =============================================================================
 * Upload Entry Points — Project Entries (42 entries, incl. ADR-191 studies)
 * =============================================================================
 *
 * @module config/upload-entry-points/entries-project
 * @enterprise ADR-031 + ADR-191
 */

import type { UploadEntryPoint } from './types';

/**
 * Project upload entry points.
 * Based on ΔΟΜΗ.txt - Construction Industry Standard.
 * Categories: Διοίκηση, Κατασκευή, Πωλήσεις, Λογιστικά.
 * Includes hierarchical study entries (ADR-191) with perFloor support.
 */
export const PROJECT_ENTRY_POINTS: UploadEntryPoint[] = [
    // ------------------------------------------------------------------------
    // ΔΙΟΙΚΗΣΗ ΕΡΓΟΥ (00_Διοίκηση-Έργου)
    // ------------------------------------------------------------------------
    {
      id: 'building-permit',
      purpose: 'permit',
      domain: 'admin',
      category: 'permits',
      label: {
        el: 'Οικοδομική Άδεια',
        en: 'Building Permit',
      },
      description: {
        el: 'Άδεια δόμησης από την πολεοδομία',
        en: 'Construction permit from planning authority',
      },
      icon: 'FileCheck',
      order: 1,
    },
    {
      id: 'environmental-approval',
      purpose: 'environmental',
      domain: 'admin',
      category: 'permits',
      label: {
        el: 'Περιβαλλοντική Έγκριση',
        en: 'Environmental Approval',
      },
      description: {
        el: 'Έγκριση περιβαλλοντικών όρων',
        en: 'Environmental terms approval',
      },
      icon: 'Leaf',
      order: 2,
    },
    {
      id: 'project-contract',
      purpose: 'contract',
      domain: 'legal',
      category: 'contracts',
      label: {
        el: 'Συμβόλαιο Έργου',
        en: 'Project Contract',
      },
      description: {
        el: 'Κύρια σύμβαση έργου',
        en: 'Main project contract',
      },
      icon: 'FileSignature',
      order: 3,
    },

    // ------------------------------------------------------------------------
    // ΚΑΤΑΣΚΕΥΗ - ΣΧΕΔΙΑ (10_Κατασκευή/01_Σχέδια)
    // ------------------------------------------------------------------------
    {
      id: 'floor-plan',
      purpose: 'floorplan',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Κάτοψη',
        en: 'Floor Plan',
      },
      description: {
        el: 'Αρχιτεκτονική κάτοψη (DXF/PDF)',
        en: 'Architectural floor plan (DXF/PDF)',
      },
      icon: 'LayoutGrid',
      order: 10,
    },
    {
      id: 'section-drawing',
      purpose: 'section',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Τομή',
        en: 'Section Drawing',
      },
      description: {
        el: 'Αρχιτεκτονική τομή',
        en: 'Architectural section',
      },
      icon: 'Scissors',
      order: 11,
    },
    {
      id: 'electrical-plan',
      purpose: 'electrical',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Ηλεκτρολογικά',
        en: 'Electrical Plan',
      },
      description: {
        el: 'Σχέδια ηλεκτρολογικών εγκαταστάσεων',
        en: 'Electrical installation drawings',
      },
      icon: 'Zap',
      order: 12,
    },
    {
      id: 'plumbing-plan',
      purpose: 'plumbing',
      domain: 'construction',
      category: 'floorplans',
      label: {
        el: 'Υδραυλικά',
        en: 'Plumbing Plan',
      },
      description: {
        el: 'Σχέδια υδραυλικών εγκαταστάσεων',
        en: 'Plumbing installation drawings',
      },
      icon: 'Droplets',
      order: 13,
    },

    // ------------------------------------------------------------------------
    // ΚΑΤΑΣΚΕΥΗ - ΗΜΕΡΟΛΟΓΙΟ (10_Κατασκευή/02_Ημερολόγιο)
    // ------------------------------------------------------------------------
    {
      id: 'construction-photo',
      purpose: 'construction',
      domain: 'construction',
      category: 'photos',
      label: {
        el: 'Φωτογραφία Εργοταξίου',
        en: 'Construction Photo',
      },
      description: {
        el: 'Φωτογραφική τεκμηρίωση κατασκευής',
        en: 'Construction progress photo documentation',
      },
      icon: 'Camera',
      order: 20,
    },
    {
      id: 'construction-video',
      purpose: 'video',
      domain: 'construction',
      category: 'videos',
      label: {
        el: 'Βίντεο Εργοταξίου',
        en: 'Construction Video',
      },
      description: {
        el: 'Βίντεο τεκμηρίωση κατασκευής',
        en: 'Construction progress video documentation',
      },
      icon: 'Video',
      order: 21,
    },
    {
      id: 'voice-note',
      purpose: 'voicenote',
      domain: 'construction',
      category: 'documents',
      label: {
        el: 'Ηχητική Σημείωση',
        en: 'Voice Note',
      },
      description: {
        el: 'Ηχητική σημείωση από εργοτάξιο',
        en: 'Voice note from construction site',
      },
      icon: 'Mic',
      order: 22,
    },
    {
      id: 'daily-report',
      purpose: 'daily',
      domain: 'construction',
      category: 'documents',
      label: {
        el: 'Ημερήσιο Δελτίο',
        en: 'Daily Report',
      },
      description: {
        el: 'Ημερήσια αναφορά εργασιών',
        en: 'Daily work report',
      },
      icon: 'ClipboardList',
      order: 23,
    },

    // ------------------------------------------------------------------------
    // ΛΟΓΙΣΤΙΚΑ (30_Λογιστικά)
    // ------------------------------------------------------------------------
    {
      id: 'invoice',
      purpose: 'invoice',
      domain: 'accounting',
      category: 'documents',
      label: {
        el: 'Τιμολόγιο',
        en: 'Invoice',
      },
      description: {
        el: 'Τιμολόγιο προμηθευτή/συνεργείου',
        en: 'Supplier/contractor invoice',
      },
      icon: 'Receipt',
      order: 30,
    },
    {
      id: 'payment-receipt',
      purpose: 'receipt',
      domain: 'accounting',
      category: 'documents',
      label: {
        el: 'Απόδειξη Πληρωμής',
        en: 'Payment Receipt',
      },
      description: {
        el: 'Απόδειξη πληρωμής/έμβασμα',
        en: 'Payment receipt/bank transfer',
      },
      icon: 'CreditCard',
      order: 31,
    },
    {
      id: 'delivery-note',
      purpose: 'delivery',
      domain: 'accounting',
      category: 'documents',
      label: {
        el: 'Δελτίο Αποστολής',
        en: 'Delivery Note',
      },
      description: {
        el: 'Δελτίο αποστολής υλικών',
        en: 'Material delivery note',
      },
      icon: 'Truck',
      order: 32,
    },

    // ------------------------------------------------------------------------
    // GENERIC
    // ------------------------------------------------------------------------
    {
      id: 'project-report',
      purpose: 'report',
      domain: 'construction',
      category: 'documents',
      label: {
        el: 'Αναφορά Έργου',
        en: 'Project Report',
      },
      description: {
        el: 'Γενική αναφορά έργου',
        en: 'General project report',
      },
      icon: 'FileBarChart',
      order: 50,
    },
    {
      id: 'generic-project-doc',
      purpose: 'generic',
      domain: 'construction',
      category: 'documents',
      label: {
        el: 'Άλλο Έγγραφο',
        en: 'Other Document',
      },
      description: {
        el: 'Γενικό έγγραφο χωρίς συγκεκριμένη κατηγορία',
        en: 'Generic document without specific category',
      },
      icon: 'File',
      order: 99,
      requiresCustomTitle: true,
    },

    // ========================================================================
    // 🏢 ADR-191: ΜΕΛΕΤΕΣ ΟΙΚΟΔΟΜΙΚΗΣ ΑΔΕΙΑΣ — PROJECT LEVEL
    // ========================================================================

    // --- ADMINISTRATIVE / ΝΟΜΙΚΑ (100-119) ---
    {
      id: 'study-admin-application',
      purpose: 'study-application',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Αίτηση Οικοδομικής Άδειας', en: 'Building Permit Application' },
      description: { el: 'Αίτηση προς πολεοδομία', en: 'Application to planning authority' },
      icon: 'FileText',
      order: 100,
      group: 'administrative',
    },
    {
      id: 'study-admin-title-deed',
      purpose: 'study-title-deed',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Τίτλος Ιδιοκτησίας', en: 'Title Deed' },
      description: { el: 'Συμβόλαιο κτήσης / τίτλος ιδιοκτησίας', en: 'Property title deed / ownership document' },
      icon: 'ScrollText',
      order: 101,
      group: 'administrative',
    },
    {
      id: 'study-admin-cadastre',
      purpose: 'study-cadastre',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Κτηματογράφηση', en: 'Cadastre Certificate' },
      description: { el: 'Κτηματολογικό φύλλο / απόσπασμα', en: 'Cadastral map / excerpt' },
      icon: 'Map',
      order: 102,
      group: 'administrative',
    },
    {
      id: 'study-admin-topographic',
      purpose: 'study-topographic',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Τοπογραφικό Διάγραμμα', en: 'Topographic Survey' },
      description: { el: 'Τοπογραφικό διάγραμμα μηχανικού', en: 'Engineer topographic survey plan' },
      icon: 'MapPin',
      order: 103,
      group: 'administrative',
    },
    {
      id: 'study-admin-authority-approval',
      purpose: 'study-authority-approval',
      domain: 'admin',
      category: 'permits',
      label: { el: 'Εγκρίσεις Φορέων', en: 'Authority Approvals' },
      description: { el: 'Εγκρίσεις δασαρχείου, αρχαιολογίας κ.λπ.', en: 'Forestry, archaeology approvals etc.' },
      icon: 'ShieldCheck',
      order: 104,
      group: 'administrative',
    },
    {
      id: 'study-admin-urban-plan',
      purpose: 'study-urban-plan',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Βεβαίωση Χρήσεων Γης', en: 'Land Use Certificate' },
      description: { el: 'Βεβαίωση πολεοδομικών χρήσεων γης', en: 'Urban land use certification' },
      icon: 'FileCheck2',
      order: 105,
      group: 'administrative',
    },
    {
      id: 'study-admin-legal-status',
      purpose: 'study-legal-status',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Νομική Κατάσταση Ακινήτου', en: 'Property Legal Status' },
      description: { el: 'Πιστοποιητικό βαρών, υποθηκών κ.λπ.', en: 'Encumbrances, mortgages certificate' },
      icon: 'Scale',
      order: 106,
      group: 'administrative',
    },
    {
      id: 'study-admin-regulation',
      purpose: 'study-regulation',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Κανονισμός Πολυκατοικίας', en: 'Building Regulation' },
      description: { el: 'Κανονισμός συνιδιοκτησίας', en: 'Co-ownership building regulation' },
      icon: 'BookOpen',
      order: 107,
      group: 'administrative',
    },
    {
      id: 'study-admin-other',
      purpose: 'study-admin-other',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άλλο Διοικητικό', en: 'Other Administrative' },
      description: { el: 'Λοιπό διοικητικό/νομικό έγγραφο', en: 'Other administrative/legal document' },
      icon: 'File',
      order: 119,
      group: 'administrative',
      requiresCustomTitle: true,
    },

    // --- FISCAL / ΑΣΦΑΛΙΣΤΙΚΑ (200-219) ---
    {
      id: 'study-fiscal-efka',
      purpose: 'study-efka',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Εισφορές ΕΦΚΑ', en: 'EFKA Contributions' },
      description: { el: 'Αποδεικτικό εισφορών ΕΦΚΑ (e-ΕΦΚΑ)', en: 'EFKA social insurance proof' },
      icon: 'Landmark',
      order: 200,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-engineer-fees',
      purpose: 'study-engineer-fees',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Αμοιβές Μηχανικών', en: 'Engineer Fees' },
      description: { el: 'Δήλωση αμοιβής μηχανικών (ΤΕΕ)', en: 'Engineer fee declaration (TEE)' },
      icon: 'Calculator',
      order: 201,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-fem',
      purpose: 'study-fem',
      domain: 'admin',
      category: 'documents',
      label: { el: 'ΦΕΜ (Φόρος Μηχανικού)', en: 'FEM (Engineer Tax)' },
      description: { el: 'Φορολογικό Ένσημο Μηχανικού', en: 'Engineer fiscal stamp' },
      icon: 'Stamp',
      order: 202,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-deductions',
      purpose: 'study-deductions',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Κρατήσεις / Τέλη', en: 'Deductions / Fees' },
      description: { el: 'Κρατήσεις ΤΕΕ, ΕΜΠ, ΤΣΜΕΔΕ', en: 'TEE, EMP, TSMEDE deductions' },
      icon: 'Percent',
      order: 203,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-municipal-tax',
      purpose: 'study-municipal-tax',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Δημοτικά Τέλη', en: 'Municipal Fees' },
      description: { el: 'Αποδεικτικά δημοτικών τελών', en: 'Municipal fee receipts' },
      icon: 'Building2',
      order: 204,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-insurance',
      purpose: 'study-insurance',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Ασφαλιστήριο Έργου', en: 'Project Insurance' },
      description: { el: 'Ασφαλιστήριο συμβόλαιο κατασκευής', en: 'Construction project insurance policy' },
      icon: 'ShieldCheck',
      order: 205,
      group: 'fiscal',
    },
    {
      id: 'study-fiscal-other',
      purpose: 'study-fiscal-other',
      domain: 'admin',
      category: 'documents',
      label: { el: 'Άλλο Φορολογικό', en: 'Other Fiscal' },
      description: { el: 'Λοιπό φορολογικό/ασφαλιστικό έγγραφο', en: 'Other fiscal/insurance document' },
      icon: 'File',
      order: 219,
      group: 'fiscal',
      requiresCustomTitle: true,
    },

    // --- ENERGY / ΕΝΕΡΓΕΙΑΚΑ (600-619) ---
    {
      id: 'study-energy-mea',
      purpose: 'study-mea',
      domain: 'construction',
      category: 'documents',
      label: { el: 'ΜΕΑ / ΚΕΝΑΚ', en: 'Energy Study (KENAK)' },
      description: { el: 'Μελέτη Ενεργειακής Απόδοσης / ΚΕΝΑΚ', en: 'Energy performance study / KENAK' },
      icon: 'Zap',
      order: 600,
      group: 'energy',
    },
    {
      id: 'study-energy-certificate',
      purpose: 'study-energy-cert',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Ενεργειακό Πιστοποιητικό (ΠΕΑ)', en: 'Energy Certificate (PEA)' },
      description: { el: 'Πιστοποιητικό Ενεργειακής Απόδοσης', en: 'Energy Performance Certificate' },
      icon: 'Award',
      order: 601,
      group: 'energy',
    },
    {
      id: 'study-energy-insulation',
      purpose: 'study-insulation',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Μελέτη Θερμομόνωσης', en: 'Insulation Study' },
      description: { el: 'Μελέτη θερμομόνωσης κτιρίου', en: 'Building thermal insulation study' },
      icon: 'Thermometer',
      order: 602,
      group: 'energy',
    },
    {
      id: 'study-energy-other',
      purpose: 'study-energy-other',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Άλλο Ενεργειακό', en: 'Other Energy' },
      description: { el: 'Λοιπό ενεργειακό έγγραφο', en: 'Other energy document' },
      icon: 'File',
      order: 619,
      group: 'energy',
      requiresCustomTitle: true,
    },

    // --- SITE / ΕΡΓΟΤΑΞΙΑΚΑ (700-719) ---
    {
      id: 'study-site-say-fay',
      purpose: 'study-say-fay',
      domain: 'construction',
      category: 'documents',
      label: { el: 'ΣΑΥ-ΦΑΥ', en: 'Safety Plan (SAY-FAY)' },
      description: { el: 'Σχέδιο Ασφάλειας & Υγείας / Φάκελος', en: 'Health & Safety Plan / File' },
      icon: 'HardHat',
      order: 700,
      group: 'site',
    },
    {
      id: 'study-site-waste',
      purpose: 'study-waste',
      domain: 'construction',
      category: 'documents',
      label: { el: 'ΣΔΑ (Διαχείριση Αποβλήτων)', en: 'Waste Management Plan' },
      description: { el: 'Σχέδιο Διαχείρισης Αποβλήτων', en: 'Construction waste management plan' },
      icon: 'Trash2',
      order: 701,
      group: 'site',
    },
    {
      id: 'study-site-schedule',
      purpose: 'study-schedule',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Χρονοδιάγραμμα Κατασκευής', en: 'Construction Schedule' },
      description: { el: 'Χρονοδιάγραμμα εργασιών (Gantt)', en: 'Construction work schedule (Gantt)' },
      icon: 'CalendarRange',
      order: 702,
      group: 'site',
    },
    {
      id: 'study-site-environmental',
      purpose: 'study-env-terms',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Περιβαλλοντικοί Όροι', en: 'Environmental Terms' },
      description: { el: 'Απόφαση Έγκρισης Περιβαλλοντικών Όρων', en: 'Environmental terms approval decision' },
      icon: 'TreeDeciduous',
      order: 703,
      group: 'site',
    },
    {
      id: 'study-site-fire-safety',
      purpose: 'study-fire-safety',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Μελέτη Πυρασφάλειας', en: 'Fire Safety Study' },
      description: { el: 'Μελέτη πυρασφάλειας / πυροπροστασίας', en: 'Fire protection study' },
      icon: 'Flame',
      order: 704,
      group: 'site',
    },
    {
      id: 'study-site-other',
      purpose: 'study-site-other',
      domain: 'construction',
      category: 'documents',
      label: { el: 'Άλλο Εργοταξιακό', en: 'Other Site Document' },
      description: { el: 'Λοιπό εργοταξιακό/περιβαλλοντικό', en: 'Other site/environmental document' },
      icon: 'File',
      order: 719,
      group: 'site',
      requiresCustomTitle: true,
    },
];
