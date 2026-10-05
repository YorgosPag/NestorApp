/**
 * ADR-871 §10.6 — ο κατάλογος **«Εργαλεία»** της στήλης του γραφείου.
 * Κανόνες: βλ. `catalog-main.ts` (σειρά δήλωσης · δηλωμένος τίτλος · ομάδα χωρίς διεύθυνση).
 */

import { FileText, FolderTree, MapPin, PenTool, Scale } from 'lucide-react';
import { OFFICE_CASES_ROUTE } from '@/lib/conveyance/conveyance-routes';
import type { CatalogEntry } from './catalog-types';

export const TOOLS_CATALOG = [
  // ADR-871 §10.5 Υ12 — ο ιεραρχικός περιηγητής, πρώτος στα εργαλεία.
  { kind: 'link', navLabelKey: 'pages.navigation', icon: MapPin, href: '/navigation' },
  { kind: 'link', navLabelKey: 'tools.fileManager', icon: FolderTree, href: '/files' },
  // 🔑 Ήταν γονιός με `href: '/legal-documents'` — διεύθυνση **χωρίς σελίδα** (jobs-registry
  //    `LEGAL_DOCUMENTS_STATUS`). Ως ομάδα δεν ισχυρίζεται πια ότι είναι σελίδα (§10.6 Γ3/Γ4).
  {
    kind: 'group',
    id: 'legal',
    navLabelKey: 'tools.legal',
    icon: FileText,
    items: [
      { kind: 'link', navLabelKey: 'tools.obligations', icon: PenTool, href: '/obligations' },
      // 🔑 ADR-901 §15 Γ2 — «Οι υποθέσεις μου», στον χώρο του ΓΡΑΦΕΙΟΥ: όσες ανέλαβε ο επαγγελματίας για λογαριασμό
      //    αυτού του γραφείου. ΙΔΙΟ κλειδί τίτλου με την προσωπική γραμμή (`personal-navigation`): μία έννοια, δύο
      //    σπίτια — και κανένα νέο κλειδί στο `navigation.json`.
      // ⚠️ ΧΩΡΙΣ `policy`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ (Υ18: «ό,τι δηλώνεται επιβάλλεται»): η σελίδα δεν φυλάσσεται από
      //    δικαίωμα γραφείου αλλά από τη ΣΥΜΜΕΤΟΧΗ του ανθρώπου (`decideEngagement`, `uid`). Μια πολιτική εδώ θα
      //    έκρυβε το κουμπί από μέλος που ΕΧΕΙ υποθέσεις, ή θα υπονοούσε φρουρό που δεν υπάρχει (OWASP A01).
      //    Όποιος δεν έχει υποθέσεις βλέπει την κενή κατάσταση — και εκεί θα φτάσει η πρώτη του πρόταση.
      { kind: 'link', navLabelKey: 'personal.items.myCases', icon: Scale, href: OFFICE_CASES_ROUTE },
    ],
  },
] as const satisfies readonly CatalogEntry[];
