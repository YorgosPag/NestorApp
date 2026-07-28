/**
 * ADR-358 §5.5.bis — CAPABILITY ANCHOR: **δύο σημεία προσάρτησης, ένα ανά variant.**
 *
 * Η απόφαση του §5.5.bis (Επιλογή Γ, «Both Status Bar + Ribbon») δεν είναι «δύο αρχεία
 * επιτρέπεται να γράψουν τη λέξη CurrentLayerPicker». Είναι: **ΕΝΑ component, δύο οπτικές
 * παραλλαγές, δύο θέσεις στην οθόνη**, συγχρονισμένες από το `LayerStore.currentLayerId`.
 * Τρίτη προσάρτηση = τρίτο σημείο που πρέπει να συμφωνήσει· διπλή προσάρτηση της ίδιας
 * παραλλαγής = δύο πανομοιότυπα κουμπιά που ο χρήστης δεν ξέρει γιατί βλέπει.
 *
 * ⚠️ **Γιατί δεν αρκεί το allowlist του `.ssot-registry.json`.** Το CHECK 3.7 δουλεύει ανά
 * ΑΡΧΕΙΟ: ένα αρχείο είναι είτε εντός είτε εκτός λίστας, ολόκληρο. Όσο το ribbon mount point
 * ζούσε στο `RibbonPanel.tsx` (168 γραμμές, μία ευθύνη, σχεδόν ακίνητο) αυτό ήταν αρκετό.
 * Το ADR-718 split το μετακόμισε στο `ribbon-widget-registry.tsx` — αρχείο που **μεγαλώνει με
 * κάθε νέο widget** και το αγγίζει κάθε ADR που προσθέτει κουμπί. Μια δεύτερη καταχώριση **μέσα**
 * σε εκείνο το αρχείο περνά αόρατη από το ratchet. Ο έλεγχος εδώ μετρά **προσαρτήσεις**, όχι
 * διαδρομές αρχείων: ισχύει ακέραιος όπου κι αν μετακομίσει αύριο το mount point.
 *
 * Το ίδιο μάθημα με το ADR-587 §6.1: κανόνας που δεν τον **ρωτά** κανείς δεν ισχύει — και ένα
 * allowlist απαντά «ποιος επιτρέπεται», ποτέ «πόσες φορές».
 *
 * @see ../CurrentLayerPicker.tsx — το ΕΝΑ component (`variant: 'status-bar' | 'ribbon'`)
 * @see ../useCurrentLayerChange.ts — η ΜΙΑ διαδρομή αλλαγής (permission gate + toast + FIFO)
 */

import * as fs from 'fs';
import * as path from 'path';

const SUBAPP_ROOT = path.join(__dirname, '..', '..', '..', '..');

/** Η προσάρτηση είναι **χρήση σε JSX** (`<CurrentLayerPicker …`), όχι import ή αναφορά σε σχόλιο. */
const MOUNT = /<CurrentLayerPicker[\s/>]/g;

/** Το `variant` της συγκεκριμένης προσάρτησης — αυτό ξεχωρίζει τα δύο σημεία μεταξύ τους. */
const MOUNT_WITH_VARIANT = /<CurrentLayerPicker\b[^>]*?variant=["']([a-z-]+)["']/g;

/**
 * Ό,τι μπορεί να προσαρτήσει React component στο subapp. Τα `__tests__` εξαιρούνται (ένα test
 * ΠΡΕΠΕΙ να μπορεί να τον στήσει), όπως και ο ίδιος ο φάκελος του picker — εκεί ζει η εσωτερική
 * του σύνθεση (`CurrentLayerPicker` → `CurrentLayerPickerPopover`), που δεν είναι θέση στην οθόνη.
 */
function mountCandidates(): string[] {
  const out: string[] = [];
  const pickerDir = path.join(SUBAPP_ROOT, 'ui', 'components', 'layer-picker');
  (function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        if (full === pickerDir) continue;
        walk(full);
      } else if (entry.name.endsWith('.tsx')) {
        out.push(full);
      }
    }
  })(SUBAPP_ROOT);
  return out;
}

/** Πόσες φορές προσαρτάται ο picker σε κάθε αρχείο, με τη διαδρομή σχετικά με το subapp. */
function mountsByFile(): Map<string, number> {
  const found = new Map<string, number>();
  for (const file of mountCandidates()) {
    const matches = fs.readFileSync(file, 'utf8').match(MOUNT);
    if (matches) found.set(path.relative(SUBAPP_ROOT, file).replace(/\\/g, '/'), matches.length);
  }
  return found;
}

/**
 * Τα δύο σημεία, με τον λόγο τους. Προσθήκη εδώ είναι **συνειδητή απόφαση** που αλλάζει το
 * §5.5.bis — όχι παράλειψη που την ανακαλύπτει ο χρήστης βλέποντας τρία ίδια κουμπιά.
 */
const DECLARED_MOUNTS: Readonly<Record<string, string>> = {
  'statusbar/CadStatusBar.tsx': 'variant status-bar — η συμπαγής ένδειξη δίπλα σε Polar/Ortho',
  'ui/ribbon/components/ribbon-widget-registry.tsx': 'variant ribbon — μέσω του χάρτη widgetId→widget',
};

describe('ADR-358 §5.5.bis — δύο σημεία προσάρτησης, ούτε ένα παραπάνω', () => {
  it('η σάρωση βρήκε αρχεία (αλλιώς οι έλεγχοι από κάτω είναι κενοί)', () => {
    expect(mountCandidates().length).toBeGreaterThan(400);
  });

  it('ο picker προσαρτάται ΑΚΡΙΒΩΣ στα δύο δηλωμένα σημεία', () => {
    expect([...mountsByFile().keys()].sort()).toEqual(Object.keys(DECLARED_MOUNTS).sort());
  });

  it('κάθε σημείο προσαρτά ΜΙΑ φορά — δεύτερη μέσα στο ίδιο αρχείο είναι αόρατη στο CHECK 3.7', () => {
    // Ακριβώς το κενό που άνοιξε το ADR-718 split: το registry είναι πλέον αρχείο υψηλής
    // κίνησης, allowlisted ΟΛΟΚΛΗΡΟ. Το ratchet δεν μπορεί να μετρήσει· αυτό μπορεί.
    expect([...mountsByFile().values()]).toEqual([1, 1]);
  });

  it('οι δύο προσαρτήσεις είναι ΔΙΑΦΟΡΕΤΙΚΕΣ παραλλαγές (όχι δύο ίδια κουμπιά)', () => {
    const variants: string[] = [];
    for (const file of mountCandidates()) {
      const source = fs.readFileSync(file, 'utf8');
      for (const m of source.matchAll(MOUNT_WITH_VARIANT)) variants.push(m[1]!);
    }
    expect(variants.sort()).toEqual(['ribbon', 'status-bar']);
  });

  it('ΑΡΝΗΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: το pattern ξεχωρίζει προσάρτηση από import/σχόλιο', () => {
    // Χωρίς αυτό, ένα pattern που πιάνει τα πάντα (ή τίποτα) θα περνούσε τους από πάνω ελέγχους.
    const mounts = (s: string): number => (s.match(new RegExp(MOUNT.source, 'g')) ?? []).length;
    expect(mounts('<CurrentLayerPicker variant="ribbon" />')).toBe(1);
    expect(mounts('<CurrentLayerPicker\n  variant="ribbon"\n/>')).toBe(1);
    expect(mounts("import { CurrentLayerPicker } from './CurrentLayerPicker';")).toBe(0);
    expect(mounts('// ο CurrentLayerPicker ζει σε δύο σημεία')).toBe(0);
    expect(mounts('<CurrentLayerPickerPopover state={s} />')).toBe(0);
  });
});
