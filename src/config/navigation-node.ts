/**
 * ADR-871 §10.6 Υ13/Υ14/Υ19 — το **δομικό** σχήμα ενός κόμβου πλοήγησης.
 *
 * Δύο είδη, ποτέ ένα με προαιρετικά πεδία (Primer NavList · Carbon `SideNavMenu` ·
 * Atlassian `ExpandableMenuItem`):
 *
 *   • **σύνδεσμος** — έχει διεύθυνση, δεν έχει παιδιά
 *   • **ομάδα**     — κουμπί που ανοίγει· έχει **ταυτότητα** και παιδιά, **ΔΕΝ** έχει διεύθυνση
 *
 * Ο γονιός-ομάδα αποδιδόταν ήδη **πάντα** ως κουμπί, αλλά ο τύπος του έλεγε «href» —
 * γι' αυτό ένα `/legal-documents` που δεν είναι σελίδα ζούσε απαρατήρητο (§10.6 Γ4).
 *
 * Καθαρό αρχείο (χωρίς React, χωρίς εικονίδια): το ρωτούν τα φίλτρα δικαιώματος,
 * ικανότητας και δουλειάς. Το συμβόλαιο απόδοσης (`@/types/sidebar`) το **στενεύει**.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-871-personal-space-sidebar.md §10.6
 */

export interface NavLinkNode {
  readonly kind: 'link';
  readonly href: string;
}

export interface NavGroupNode<L extends NavLinkNode = NavLinkNode> {
  readonly kind: 'group';
  /** Ταυτότητα — **χωρίς `/`**, άρα δομικά ξένη προς κάθε `href`. */
  readonly id: string;
  readonly items: readonly L[];
}

/**
 * Είναι ομάδα; — **type guard** και όχι σύγκριση `kind` επί τόπου: πάνω σε γενικούς τύπους
 * (`L | G`) η σύγκριση του διακριτικού **δεν** στενεύει τις παραμέτρους τύπου, ενώ το
 * `node is G` στενεύει **και** τον ψευδή κλάδο σε `L` — χωρίς κανένα `as` στους καλούντες.
 */
export function isNavGroup<L extends NavLinkNode, G extends NavGroupNode<L>>(
  node: L | G,
): node is G {
  return node.kind === 'group';
}

/**
 * **Το ΕΝΑ κλειδί κόμβου**: `href` για σύνδεσμο, `id` για ομάδα. Ό,τι κρατά κόμβους σε
 * χάρτη ή σύνολο (δουλειές, «κρυμμένα», ανοιχτές ομάδες, React `key`) ρωτά **αυτό**.
 */
export function navNodeKey(node: NavLinkNode | NavGroupNode): string {
  return node.kind === 'link' ? node.href : node.id;
}

/**
 * **Ο ΕΝΑΣ κανόνας «κενή ομάδα»** (Υ19): η ομάδα με τα παιδιά που κράτησε ένα φίλτρο —
 * ή `null` όταν δεν κράτησε κανένα. Κουμπί που ανοίγει το τίποτα είναι ψέμα της διεπαφής.
 *
 * `Object.assign` και όχι spread: το `{ ...group }` πάνω σε generic `G` δεν είναι
 * εκχωρήσιμο στο `G` (γνωστός περιορισμός TS) και θα ζητούσε assertion.
 */
export function withGroupItems<L extends NavLinkNode, G extends NavGroupNode<L>>(
  group: G,
  kept: readonly L[],
): G | null {
  return kept.length === 0 ? null : Object.assign({}, group, { items: kept });
}
