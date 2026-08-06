'use client';

/**
 * ADR-583 / ADR-612 — γλυφές **συμβόλων σχεδίου** (annotation symbols) για το
 * `RibbonButtonIcon`. Καθαρά δεδομένα: σταθερές JSX, καμία λογική απόδοσης.
 *
 * Ίδιος SRP διαχωρισμός με τα `RibbonButtonIconPaths.tsx` /
 * `ribbon-icon-paths-view-measure.tsx` / `table-icon-glyph.tsx` (N.7.1, όριο 500 γρ.):
 * ο διακόπτης του `RibbonButtonIcon` μένει **δρομολόγηση**, τα σχήματα ζουν εδώ.
 *
 * Η οικογένεια είναι συνεκτική και όχι αυθαίρετη: όλα είναι τα καθιερωμένα σύμβολα
 * που μπαίνουν **πάνω** στο σχέδιο (βορράς, τομή, άξονας, στάθμη, λεπτομέρεια,
 * αναθεώρηση, γραφική κλίμακα, ετικέτα ανοίγματος) — όχι εργαλεία σχεδίασης.
 */

import * as React from 'react';

/** Πυξίδα τοπογράφου: γεμάτη αιχμή + στέλεχος + «N». */
export const NORTH_ARROW_PATH = (
  <>
    <path d="M12 3 L15 10 L9 10 Z" fill="currentColor" stroke="none" />
    <line x1="12" y1="10" x2="12" y2="21" />
    <text x="12" y="6.5" textAnchor="middle" fontSize="5" fontWeight="700" stroke="none" fill="currentColor">N</text>
  </>
);

/** Σήμανση τομής: φυσαλίδα ταυτότητας + βέλος φοράς θέασης (Revit section head). */
export const SECTION_MARK_PATH = (
  <>
    <circle cx="12" cy="8" r="5.5" fill="none" />
    <text x="12" y="10" textAnchor="middle" fontSize="6" fontWeight="700" stroke="none" fill="currentColor">A</text>
    <line x1="12" y1="13.5" x2="12" y2="17" />
    <path d="M12 21 L15 16 L9 16 Z" fill="currentColor" stroke="none" />
  </>
);

/** Φυσαλίδα άξονα: κενός κύκλος + ταυτότητα άξονα. */
export const GRID_BUBBLE_PATH = (
  <>
    <circle cx="12" cy="12" r="8" fill="none" />
    <text x="12" y="15" textAnchor="middle" fontSize="9" fontWeight="700" stroke="none" fill="currentColor">1</text>
  </>
);

/** Σήμανση στάθμης: γεμάτο τρίγωνο προς τα κάτω πάνω σε γραμμή αναφοράς + τιμή. */
export const ELEVATION_MARK_PATH = (
  <>
    <line x1="4" y1="15" x2="20" y2="15" />
    <path d="M12 15 L15 9 L9 9 Z" fill="currentColor" stroke="none" />
    <text x="12" y="6" textAnchor="middle" fontSize="4.5" stroke="none" fill="currentColor">0.00</text>
  </>
);

/** Παραπομπή λεπτομέρειας: φυσαλίδα + αγκιστρωτή γραμμή οδήγησης. */
export const DETAIL_CALLOUT_PATH = (
  <>
    <circle cx="15" cy="9" r="5" fill="none" />
    <text x="15" y="11" textAnchor="middle" fontSize="5.5" fontWeight="700" stroke="none" fill="currentColor">1</text>
    <path d="M11 12 A6 6 0 1 0 6 17" fill="none" />
  </>
);

/** Ετικέτα αναθεώρησης: αριθμός μέσα σε τρίγωνο «δέλτα». */
export const REVISION_TAG_PATH = (
  <>
    <path d="M12 3 L20 19 L4 19 Z" fill="none" />
    <text x="12" y="18" textAnchor="middle" fontSize="7" fontWeight="700" stroke="none" fill="currentColor">1</text>
  </>
);

/** Γραφική κλίμακα: η κλασική εναλλασσόμενη «σκακιέρα» (χαρτογραφική γλυφή). */
export const SCALE_BAR_PATH = (
  <>
    <rect x="3" y="10" width="4.5" height="4" fill="currentColor" stroke="none" />
    <rect x="7.5" y="10" width="4.5" height="4" fill="none" />
    <rect x="12" y="10" width="4.5" height="4" fill="currentColor" stroke="none" />
    <rect x="16.5" y="10" width="4.5" height="4" fill="none" />
  </>
);

/**
 * ADR-612 — ετικέτα ανοίγματος: κουτί 3 κελιών (εξωτερικό ορθογώνιο + μεσαία γραμμή
 * πλήρους πλάτους + κάθετη γραμμή στο κάτω μισό) — καθρεφτίζει τη διάταξη στον καμβά.
 */
export const OPENING_INFO_TAG_PATH = (
  <>
    <rect x="4" y="5" width="16" height="14" fill="none" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="12" y1="12" x2="12" y2="19" />
  </>
);
