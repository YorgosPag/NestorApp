/**
 * @fileoverview **Η κεφαλίδα του προβολέα κάτοψης αναδιπλώνει** — άγκυρα πηγής (ADR-907 §11.14).
 * @related components/shared/files/media/FloorplanGallery.tsx
 *
 * 🔴 **Μετρημένο στην παραγωγή (2026-10-12)**: στα 390 και στα 320 css px η κεφαλίδα είχε πλάτος 332 / 262, περιεχόμενο
 * 639, και `overflow: clip` — οι εννέα ενέργειες της γραμμής «Ενέργειες κάτοψης» (μέτρηση ×3, μεγέθυνση ×3, πλήρης οθόνη,
 * λήψη, διαγραφή) ζωγραφίζονταν **εκτός κάδρου**, χωρίς κύλιση: άφταστες με το δάχτυλο.
 *
 * ΚΑ-1 — η κεφαλίδα και η γραμμή ενεργειών αναδιπλώνουν (`flex-wrap`);
 * ΚΑ-2 — ο τίτλος δεν κρατά σταθερό ελάχιστο πλάτος κάτω από το `sm` — αυτό έσπρωχνε τις ενέργειες έξω.
 *
 * ⚠️ **ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ**: το jsdom δεν έχει διάταξη — αυτή η σουίτα διαβάζει **κλάσεις**, δεν μετρά pixels. Ότι τα
 * κουμπιά χωρούν το βλέπει μόνο browser (η πύλη 3.94 μετρά μόνο δημόσιες σελίδες· ο χώρος εργασίας δεν έχει ακόμη δική του).
 * Η άγκυρα πιάνει την **επιστροφή** του ελαττώματος (κάποιος σβήνει το `flex-wrap`), όχι ένα νέο κουμπί που δεν χωρά.
 */

import fs from 'node:fs';
import path from 'node:path';

const SOURCE = fs.readFileSync(path.resolve(__dirname, '..', 'FloorplanGallery.tsx'), 'utf8');

/** Οι κλάσεις του στοιχείου που ανοίγει με αυτό το θραύσμα JSX — ή ρίψη, ώστε μια μετονομασία να μην περνά ως «πράσινο». */
function classesOpenedBy(fragment: string, followedBy: string): readonly string[] {
  const lines = SOURCE.split(/\r?\n/u).filter((line) => line.includes(fragment) && line.includes(followedBy));
  if (lines.length !== 1) throw new Error(`αναμενόταν ΜΙΑ γραμμή για «${fragment} … ${followedBy}», βρέθηκαν ${lines.length}`);
  const classes = lines[0].match(/className="([^"]+)"/u)?.[1];
  if (classes === undefined) throw new Error(`η γραμμή «${fragment}» δεν έχει κυριολεκτικό className`);
  return classes.split(/\s+/u);
}

describe('FloorplanGallery — η κεφαλίδα στα στενά πλάτη', () => {
  it('🔴 ΚΑ-1 κεφαλίδα και γραμμή ενεργειών αναδιπλώνουν', () => {
    expect(classesOpenedBy('<header', 'border-b bg-background/95')).toContain('flex-wrap');
    // Η ενσωματωμένη γραμμή ενεργειών — όχι της πλήρους οθόνης, που έχει μόνο τα χειριστήρια μεγέθυνσης (`ml-auto`).
    const inline = SOURCE.split(/\r?\n/u).filter((line) => line.includes("aria-label={t('floorplan.actions')}") && !line.includes('ml-auto'));
    expect(inline).toHaveLength(1);
    expect(inline[0].match(/className="([^"]+)"/u)?.[1].split(/\s+/u)).toContain('flex-wrap');
  });

  it('🔴 ΚΑ-2 ο τίτλος δεν κρατά σταθερό ελάχιστο πλάτος κάτω από το `sm`, και η πλοήγηση μπορεί να στενέψει', () => {
    expect(SOURCE).not.toMatch(/(^|[\s"])min-w-\[200px\]/u);
    expect(SOURCE).toContain('sm:min-w-[200px]');
    expect(classesOpenedBy('<nav', "aria-label={t('floorplan.navigation')}")).toContain('min-w-0');
  });
});
