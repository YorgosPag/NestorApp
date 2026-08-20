/**
 * @fileoverview **ΑΓΚΥΡΕΣ: Ο ΣΥΝΔΕΣΜΟΣ ΟΔΗΓΕΙ ΚΑΠΟΥ** (ADR-777 §8.30).
 * @related lib/routes/entityRoutes · app/(app)/properties/[id]/page.tsx
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΟΥΝ — ΤΟ ΕΛΑΤΤΩΜΑ ΕΠΕΖΗΣΕ ΕΠΕΙΔΗ ΚΑΘΕ ΚΟΜΜΑΤΙ ΗΤΑΝ «ΣΩΣΤΟ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `ENTITY_ROUTES.properties.withId` έδινε `/properties?propertyId=…`. Έγκυρη
 * διεύθυνση. Η σελίδα `/properties` υπήρχε και φόρτωνε. Το `/properties/[id]`
 * ανακατεύθυνε κανονικά. **Κανένα κομμάτι δεν ήταν σπασμένο** — απλώς ο
 * προορισμός δεν διάβαζε ποτέ την παράμετρο, και κανένα test δεν ρωτούσε
 * *«φτάνει ο σύνδεσμος σε κάτι που ξέρει ποιο ακίνητο εννοεί;»*.
 *
 * 🔑 **Η ΠΡΩΤΗ ΑΓΚΥΡΑ ΕΙΝΑΙ Η ΜΟΝΗ ΠΟΥ ΘΑ ΤΟ ΕΙΧΕ ΠΙΑΣΕΙ.** Ένα test που
 * επιβεβαιώνει μόνο τη συμβολοσειρά του `withId` θα ήταν **πράσινο πάνω στο
 * ελάττωμα**: η παλιά τιμή ήταν ακριβώς η τιμή που ο συγγραφέας της εννοούσε. Η
 * ερώτηση που έλειπε είναι **τι κάνει ο προορισμός**.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENTITY_ROUTES } from '@/lib/routes';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

const read = (relative: string): string =>
  readFileSync(join(REPO_ROOT, relative), 'utf8');

const PROPERTY_DETAIL_PAGE = 'src/app/(app)/properties/[id]/page.tsx';
const DETAIL_SURFACE = 'src/features/property-detail-surface/PropertyDetailSurface.tsx';

describe('ADR-777 §8.30 — η καρτέλα ακινήτου έχει διεύθυνση που οδηγεί κάπου', () => {
  // ==========================================================================
  // Α1 — Ο ΠΡΟΟΡΙΣΜΟΣ ΕΙΝΑΙ ΣΕΛΙΔΑ, ΟΧΙ ΑΝΑΚΑΤΕΥΘΥΝΣΗ
  // ==========================================================================

  it('Α1: το `withId` δείχνει σε διαδρομή που ΑΠΟΔΙΔΕΙ, δεν ανακατευθύνει', () => {
    const href = ENTITY_ROUTES.properties.withId('prop_abc');

    // Ταυτότητα στη **διαδρομή**, όχι σε ερώτημα: ένα ερώτημα το αγνοεί όποιος
    // δεν το διαβάζει· ένα δυναμικό τμήμα το κρατά το ίδιο το framework.
    expect(href).toBe('/properties/prop_abc');
    expect(href).not.toContain('?');

    const page = read(PROPERTY_DETAIL_PAGE);

    // 🔴 Η καρδιά της άγκυρας. Επί μήνες αυτό το αρχείο ήταν **σκέτο**
    // `redirect()` προς σελίδα που αγνοούσε την παράμετρο.
    expect(page).not.toMatch(/\bredirect\s*\(/);
    expect(page).toContain('PropertyDetailPageContent');
  });

  it('Α2: η σελίδα παραδίδει την ταυτότητα της διαδρομής στο περιεχόμενο', () => {
    const page = read(PROPERTY_DETAIL_PAGE);

    // Χωρίς αυτό, η σελίδα θα υπήρχε και θα έδειχνε **οτιδήποτε** — η ακριβής
    // αστοχία του `/properties`, μια στάση πιο μέσα.
    expect(page).toMatch(/await\s+params/);
    expect(page).toMatch(/propertyId=\{\s*id\s*\}/);
  });

  it('Α3: η σελίδα έχει όριο αναστολής (CHECK 3.55 — αλλιώς σταματά η παραγωγή)', () => {
    const page = read(PROPERTY_DETAIL_PAGE);
    expect(page).toContain('<Suspense');
  });

  it('Α8 🔴 η σελίδα-διακομιστής ΔΕΝ αγγίζει `searchParams` — ωμά κλειδιά στο SSR', () => {
    /*
     * 🔴 **ΜΕΤΡΗΜΕΝΟ ΣΤΟ ΣΕΡΒΙΡΙΣΜΕΝΟ HTML, ΟΧΙ ΥΠΟΘΕΤΙΚΑ.** Η πρώτη γραφή
     * διάβαζε `?tab=` από `searchParams` στη σελίδα-διακομιστή. Αυτό κάνει τη
     * διαδρομή **δυναμική** ⇒ το όριο αναστολής **δεν** πέφτει στο `fallback` ⇒
     * ο διακομιστής αποδίδει το περιεχόμενο. Και το `properties-detail` υπάρχει
     * στο i18n shell slice με **ΜΗΔΕΝ κλειδιά** (κομμένο σε επίπεδο κλειδιού,
     * ADR-744) ⇒ το HTML έφευγε με `detailPage.back`, `detailPage.absent`…
     *
     * ⚠️ Καμία πύλη δεν το έπιασε: το CHECK 3.51 Κ2 κρίνει την κλειστότητα των
     * **layouts**, και μια σελίδα είναι εξ ορισμού εκτός. Το βρήκε `curl`.
     *
     * Κάθε αδελφή σελίδα μένει στο `fallback` **ακριβώς** επειδή δεν αγγίζει
     * `searchParams` στον διακομιστή. Το ιδίωμα υπήρχε· η «βελτίωση» το έσπασε.
     */
    const page = read(PROPERTY_DETAIL_PAGE);
    const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\*.*$/gm, '');
    expect(code).not.toMatch(/\bsearchParams\b/);

    // Και η ανάγνωση ζει στον πελάτη, αλλιώς το `?tab=` απλώς χάθηκε.
    const content = read('src/components/properties/detail/PropertyDetailPageContent.tsx');
    expect(content).toContain('useSearchParams');
    expect(content).toMatch(/searchParams\.get\(['"]tab['"]\)/);
  });

  // ==========================================================================
  // Α4 — ΚΑΜΙΑ ΤΡΙΤΗ ΣΥΜΒΑΣΗ
  // ==========================================================================

  it('Α4: το μητρώο ξεχωρίζει «ποιο ακίνητο» από «ποια γραμμή της λίστας»', () => {
    // Δύο **διαφορετικά** ερωτήματα, δύο ονομασμένες απαντήσεις. Το ελάττωμα
    // γεννήθηκε ακριβώς επειδή αυτά τα δύο μοιράζονταν μία διατύπωση.
    expect(ENTITY_ROUTES.properties.withId('prop_1')).toBe('/properties/prop_1');
    expect(ENTITY_ROUTES.properties.inSpaces('prop_1')).toBe(
      '/spaces/properties?propertyId=prop_1',
    );
    expect(ENTITY_ROUTES.properties.withTab('prop_1', 'documents')).toBe(
      '/properties/prop_1?tab=documents',
    );
  });

  it('Α5: ταυτότητα από δεδομένα ⇒ κωδικοποιείται, ποτέ ωμή στη διεύθυνση', () => {
    // Μια ταυτότητα με `#` θα έκοβε τη διεύθυνση **σε ένα μόνο έγγραφο** — το
    // χειρότερο είδος σφάλματος, γιατί τα άλλα 7 θα δούλευαν.
    expect(ENTITY_ROUTES.properties.withId('a#b')).toBe('/properties/a%23b');
    expect(ENTITY_ROUTES.properties.withTab('a b', 'φωτο')).toBe(
      `/properties/a%20b?tab=${encodeURIComponent('φωτο')}`,
    );
  });

  // ==========================================================================
  // Α6 — ΕΝΑΣ ΙΔΙΟΚΤΗΤΗΣ ΤΗΣ ΚΑΡΤΕΛΑΣ
  // ==========================================================================

  it('Α6: η σύνθεση των καρτελών ζει σε ΕΝΑ αρχείο', () => {
    // Πριν το §8.30 υπήρχαν **δύο** συνθέσεις (δεξιά στήλη + συρτάρι
    // δημιουργίας) και η σελίδα θα γινόταν η **τρίτη**. Η ημέρα που κάποιος
    // προσθέτει έβδομη καρτέλα, μία από τις τρεις θα την έχανε — και **όλες θα
    // φαίνονταν σωστές**.
    const surface = read(DETAIL_SURFACE);
    expect(surface).toContain('PROPERTIES_COMPONENT_MAPPING');
    expect(surface).toContain('getSortedPropertiesTabs');

    for (const consumer of [
      'src/features/properties-sidebar/PropertiesSidebar.tsx',
      'src/components/building-management/dialogs/UnitQuickCreateSheet.tsx',
      'src/components/properties/detail/PropertyDetailPageContent.tsx',
    ]) {
      const source = read(consumer);
      expect(source).toContain('PropertyDetailSurface');
      expect(source).not.toContain('PROPERTIES_COMPONENT_MAPPING');
    }
  });

  // ==========================================================================
  // Α7 — ΤΟ ΠΑΝΕΛ ΖΗΤΗΣΗΣ ΦΤΑΝΕΙ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ
  // ==========================================================================

  it('Α7: η καρτέλα εταιρείας ρωτά «ποιος με ψάχνει», όπως και του ιδιώτη', () => {
    // Ο διακομιστής (`lookupOwnedPlace`) ήξερε **ήδη** και τις δύο πλευρές· μόνο
    // η μία οθόνη ρωτούσε. Το χαρακτηριστικό έφτανε στους μισούς ιδιοκτήτες και
    // **φαινόταν** να δουλεύει.
    const page = read('src/components/properties/detail/PropertyDetailPageContent.tsx');
    expect(page).toContain('usePlaceInterest');
    expect(page).toContain('PlaceInterestPanel');

    const owner = read('src/components/owner-property/OwnerPropertyDetailContent.tsx');
    expect(owner).toContain('usePlaceInterest');
  });
});
