/**
 * ADR-871 §10.6 — ο κατάλογος **«Εργαλεία»** της στήλης του γραφείου.
 * Κανόνες: βλ. `catalog-main.ts` (σειρά δήλωσης · δηλωμένος τίτλος · ομάδα χωρίς διεύθυνση).
 */

import { FileText, FolderTree, MapPin, PenTool } from 'lucide-react';
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
    items: [{ kind: 'link', navLabelKey: 'tools.obligations', icon: PenTool, href: '/obligations' }],
  },
] as const satisfies readonly CatalogEntry[];
