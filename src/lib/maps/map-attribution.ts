/**
 * @fileoverview **Η απόδοση του υποβάθρου, όπως τη ΔΗΛΩΝΕΙ ο πάροχος** — HTML → κομμάτια.
 * @related ADR-777 §8.70 (Φάση 2) · subapps/dxf-viewer/systems/basemap/basemap-source.ts
 * @module lib/maps/map-attribution
 *
 * 🔑 **Δεν τη γράφουμε με το χέρι — τη διαβάζουμε από το στυλ.** Το στυλ vector του δημόσιου
 * χάρτη δηλώνει την απόδοσή του στο TileJSON κάθε πηγής (`source.attribution`, HTML). Μια
 * χειρόγραφη συμβολοσειρά δίπλα στο στιγμιότυπο θα ήταν **δεύτερο αντίγραφο** μιας νομικής
 * υποχρέωσης, και θα έμενε σωστό μόνο μέχρι την πρώτη αλλαγή παρόχου.
 *
 * ⚠️ **Κομμάτια και όχι `dangerouslySetInnerHTML`**: το HTML έρχεται από **ξένο** διακομιστή.
 * Κρατάμε μόνο κείμενο και `href` με σχήμα `http(s)` — τίποτε άλλο δεν φτάνει ποτέ στο DOM.
 * Το σχήμα κομματιών είναι το ίδιο με το `BasemapAttributionSegment` του DXF (η λέξη
 * «OpenStreetMap» οφείλει να είναι σύνδεσμος — οδηγία απόδοσης του OSMF).
 */

export interface MapAttributionSegment {
  readonly text: string;
  /** Όταν υπάρχει, το `text` αποδίδεται ως σύνδεσμος προς αυτή τη διεύθυνση. */
  readonly href?: string;
}

function safeHref(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function segmentsOfNode(node: Node, out: MapAttributionSegment[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = collapse(node.textContent ?? '');
    if (text.length > 0) out.push({ text });
    return;
  }
  if (node instanceof HTMLAnchorElement) {
    const text = collapse(node.textContent ?? '').trim();
    if (text.length === 0) return;
    const href = safeHref(node.getAttribute('href'));
    out.push(href === undefined ? { text } : { text, href });
    return;
  }
  node.childNodes.forEach((child) => segmentsOfNode(child, out));
}

/**
 * HTML απόδοσης → κομμάτια. Κάθε ετικέτα πλην του `<a>` **ξεντύνεται** σε κείμενο.
 * Επιστρέφει κενό πίνακα για κενό ή μόνο-κενά HTML.
 */
export function attributionSegmentsFromHtml(html: string): MapAttributionSegment[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out: MapAttributionSegment[] = [];
  segmentsOfNode(doc.body, out);
  return trimEdges(out);
}

/** Κόβει τα κενά στις δύο άκρες (μόνο σε κείμενο, ποτέ σε σύνδεσμο) και πετά ό,τι άδειασε. */
function trimEdges(segments: readonly MapAttributionSegment[]): MapAttributionSegment[] {
  const last = segments.length - 1;
  return segments
    .map((segment, i) => {
      if (segment.href !== undefined) return segment;
      let text = segment.text;
      if (i === 0) text = text.trimStart();
      if (i === last) text = text.trimEnd();
      return { text };
    })
    .filter((segment) => segment.text.length > 0);
}

/**
 * Πολλές πηγές → **μία** απόδοση, χωρίς διπλότυπα (δύο πηγές του ίδιου παρόχου δηλώνουν συχνά
 * το ίδιο κείμενο). Κάθε πηγή χωρίζεται από την επόμενη με κενό.
 */
export function mergeAttributions(htmlPerSource: readonly string[]): MapAttributionSegment[] {
  const unique = Array.from(new Set(htmlPerSource.map((html) => html.trim()).filter((html) => html.length > 0)));
  return unique.flatMap((html, i) => {
    const segments = attributionSegmentsFromHtml(html);
    return i === 0 ? segments : [{ text: ' ' }, ...segments];
  });
}
