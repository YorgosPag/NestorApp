/**
 * @jest-environment node
 *
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΟΥ ΦΡΑΓΜΑΤΟΣ Ο-9** — *«μαθαίνει το σύνορο του γραφείου τα μοντέλα;»*
 * @related ADR-845 §7.5 (Φ4.2β/Βήμα Γ) · §9 (Ο-9) · services/listings/agency-media-publication
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΡΩΤΑ ΑΥΤΗ Η ΣΟΥΙΤΑ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΡΩΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   **Φεύγει ένα 3D μοντέλο ΩΣ ΜΟΝΤΕΛΟ — και μόνο αυτό;**
 *
 * Η αδελφή `agency-floorplan-publication` ρωτά το ίδιο για τις **κατόψεις**. Εδώ το κρίσιμο
 * είναι διαφορετικό: το φράγμα Ο-9 είχε **ΤΡΙΑ** σκέλη σε **δύο** αρχεία, και το τρίτο —
 * η λευκή λίστα του **ερωτήματος Firestore** — είναι **πρώτο στη σειρά εκτέλεσης**. Ένα
 * αρχείο που δεν κατεβαίνει δεν φτάνει ποτέ σε κανέναν κανόνα.
 *
 * 🏆 Γι' αυτό το **Κ4** δεν δοκιμάζει τιμή: **παράγει** τη σχέση ανάμεσα στα δύο αρχεία και
 * απαιτεί να κλείνει. Είναι ο μόνος έλεγχος που θα είχε κοκκινίσει την ημέρα που κάποιος
 * πρόσθετε σκέλος υλικού και ξεχνούσε το ερώτημα — δηλαδή ακριβώς το λάθος που **έγινε** στο
 * Ο-21 και ξαναβρέθηκε στο Βήμα Γ.
 *
 * ⚠️ Οι υποψήφιοι φτιάχνονται σε **συναρτήσεις**: σταθερή στο σώμα του `describe` που πετά
 * ρίχνει **ολόκληρο** το αρχείο με `Tests: 0 total`.
 */

import { FILE_CATEGORIES, type FileCategory } from '@/config/domain-constants';
import { MODEL_MATERIAL } from '@/lib/listings/listing-material';

import { buildPublishedModelFileRecord } from '@/lib/listings/model-file-record';
import { buildFinalizeFileRecordUpdate } from '@/services/file-record';

import {
  agencyMediaMaterial,
  isDeliverableAgencyModel,
  type AgencyMediaCandidate,
} from '../agency-media-publication';
import { publishedAgencyMediaSources } from '../agency-media-selection';
import { PUBLISHABLE_CATEGORIES } from '../agency-media.reader';

const LISTING = 'prop_a0000009-7777-4aaa-8aaa-000000000009';
const COMPANY = 'comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757';
const MODEL_MIME = 'model/gltf-binary';

function candidate(over: Partial<AgencyMediaCandidate> = {}): AgencyMediaCandidate {
  return {
    id: 'file_bbbb1111-2222-4333-8444-555566667777',
    entityType: 'property',
    storagePath: `companies/${COMPANY}/entities/property/${LISTING}/models/model.glb`,
    category: FILE_CATEGORIES.MODELS,
    classification: 'public',
    contentType: MODEL_MIME,
    status: 'ready',
    createdAt: '2026-09-08T10:00:00.000Z',
    lifecycleState: 'active',
    isDeleted: false,
    ...over,
  } as AgencyMediaCandidate;
}

/** Κανένα δηλωμένο σχέδιο — το μοντέλο **δεν** περνά από τη δήλωση της κάτοψης. */
const NO_DECLARED_FLOORPLANS: ReadonlySet<string> = new Set<string>();

describe('ADR-845 Ο-9 — το σύνορο του γραφείου μαθαίνει τα μοντέλα', () => {
  it('Κ1 — GLB σε κάδο μοντέλων φεύγει ΩΣ ΜΟΝΤΕΛΟ', () => {
    expect(agencyMediaMaterial(candidate(), NO_DECLARED_FLOORPLANS)).toEqual(MODEL_MATERIAL);
  });

  it('Κ2 — ο φρουρός είναι ΚΑΤΑΦΑΤΙΚΟΣ: ό,τι δεν είναι GLB δεν φεύγει ως μοντέλο', () => {
    const pdfInModelBucket = candidate({ contentType: 'application/pdf' });

    // ⚠️ Αν ο φρουρός ήταν άρνηση (`!isDeliverableAgencyImage`), **αυτό** θα περνούσε: ένα PDF
    //    δεν είναι εικόνα. Το μάθημα της Φ4.1, εκτελούμενο.
    expect(isDeliverableAgencyModel(pdfInModelBucket)).toBe(false);
    expect(agencyMediaMaterial(pdfInModelBucket, NO_DECLARED_FLOORPLANS)).toBeNull();
  });

  it('Κ3 — και δεν συγχέεται με τη φωτογραφία: GLB σε κάδο φωτογραφιών δεν φεύγει', () => {
    const glbInPhotoBucket = candidate({ category: FILE_CATEGORIES.PHOTOS });

    expect(agencyMediaMaterial(glbInPhotoBucket, NO_DECLARED_FLOORPLANS)).toBeNull();
  });

  it('Κ4 — 🏆 ΚΑΘΕ κατηγορία που ΜΠΟΡΕΙ να φύγει είναι στο ερώτημα Firestore', () => {
    const categories = Object.values(FILE_CATEGORIES) as FileCategory[];
    const deliverable: FileCategory[] = [];

    for (const category of categories) {
      // Δοκιμάζονται **και οι δύο** λευκές λίστες MIME, και **με** δήλωση κάτοψης: αν
      // υπάρχει οποιοσδήποτε συνδυασμός που δίνει υλικό, η κατηγορία «μπορεί να φύγει».
      const escapes = ['image/jpeg', MODEL_MIME].some((contentType) => {
        const file = candidate({ category, contentType });
        return agencyMediaMaterial(file, new Set([file.id])) !== null;
      });
      if (escapes) deliverable.push(category);
    }

    // 🔴 Η μία κατεύθυνση: ό,τι φεύγει, ΚΑΤΕΒΑΙΝΕΙ. Χωρίς αυτό, ο κανόνας δεν εκτελείται ποτέ.
    for (const category of deliverable) {
      expect(PUBLISHABLE_CATEGORIES).toContain(category);
    }

    // 🔴 Και η αντίστροφη: ό,τι κατεβαίνει, ΜΠΟΡΕΙ να φύγει — αλλιώς είναι έγγραφα που
    //    κατεβαίνουν για να πεταχτούν (το ρητό «ΜΗΝ προσθέσεις τρίτο κάδο» του αναγνώστη).
    expect([...deliverable].sort()).toEqual([...PUBLISHABLE_CATEGORIES].sort());

    // Και το μοντέλο είναι μέσα — αλλιώς τα Κ1-Κ3 θα ήταν πράσινα πάνω σε νεκρό δρόμο.
    expect(deliverable).toContain(FILE_CATEGORIES.MODELS);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Ο-13 — Η ΡΑΦΗ: ΤΟ ΕΓΓΡΑΦΟ ΠΟΥ **ΓΡΑΦΕΤΑΙ** ΦΤΑΝΕΙ ΣΤΟΝ ΑΝΑΓΝΩΣΤΗ;
// ═══════════════════════════════════════════════════════════════════════════

/**
 * **Το έγγραφο όπως ΠΡΟΣΓΕΙΩΝΕΤΑΙ**, παραγόμενο από τα **ίδια** σώματα που εκτελεί η πόρτα.
 *
 * 🔴 **ΚΑΝΕΝΑ ΠΕΔΙΟ ΓΡΑΜΜΕΝΟ ΜΕ ΤΟ ΧΕΡΙ, ΚΑΙ ΕΙΝΑΙ ΟΛΟΚΛΗΡΟ ΤΟ ΝΟΗΜΑ.** Ο `candidate()` από
 * πάνω δηλώνει `classification: 'public'` **μόνος του** — γι' αυτό τα Κ1-Κ4 έμειναν πράσινα
 * ενώ η παραγωγή έστελνε `models: []`. Εδώ το σχήμα το **παράγει ο γραφέας**: αν πάψει να
 * ικανοποιεί τον αναγνώστη, αυτή η άγκυρα κοκκινίζει — η μόνη που μπορεί.
 *
 * ⚠️ **ΔΥΟ ΕΓΓΡΑΦΕΣ, ΟΠΩΣ ΣΤΗΝ ΠΑΡΑΓΩΓΗ**: το `set()` της αναμονής και το `update()` της
 * ολοκλήρωσης. Και οι δύο ζητιούνται από τα **πραγματικά** σώματα, ποτέ με `status: 'ready'`
 * γραμμένο εδώ — ένα ημιτελές ανέβασμα οφείλει να μένει αόρατο, και αυτό το κρίνει ο κώδικας.
 */
function landedModelRecord(): AgencyMediaCandidate {
  const { recordBase, storagePath } = buildPublishedModelFileRecord({
    companyId: COMPANY,
    propertyId: LISTING,
    contentType: MODEL_MIME,
    originalFilename: `${LISTING}.glb`,
    createdBy: 'WKBWEg3DSfcdSbLNJfzGEW3vkct1',
    // ADR-845 Ο-27 — από τη δήλωση **παράγεται** η ταυτότητα δημοσίευσης. Δίνεται ολόκληρη
    // και όχι τρία σκέλη, ώστε ο γραφέας να μη μπορεί να διαφωνήσει με ό,τι ψήνεται στα bytes.
    declaration: {
      state: 'as-built',
      scope: 'active-floor',
      signatory: { name: 'Γ. Παγώνης', discipline: 'πολιτικός μηχανικός', studiedAt: '2026-09-01' },
      geometry: {
        meshCount: 3,
        triangleCount: 12_480,
        materialCount: 2,
        textureCount: 0,
        fingerprint: null,
      },
    },
  });

  const finalized = buildFinalizeFileRecordUpdate({
    sizeBytes: 122636,
    downloadUrl: `/api/storage/file/${storagePath}`,
  });

  // Το `createdAt` το βάζει ο διακομιστής (`serverTimestamp`)· εδώ μια αναγνώσιμη στιγμή,
  // γιατί το μοντέλο **δεν** την ρωτά για συμμετοχή — μόνο για ντετερμινιστική σειρά.
  return { ...recordBase, ...finalized, createdAt: '2026-09-09T09:24:19.528Z' } as AgencyMediaCandidate;
}

describe('ADR-845 Ο-13 — το μοντέλο που ΑΝΕΒΗΚΕ φτάνει στον αναγνώστη', () => {
  it('Κ5 — 🏆 Η ΠΗΓΗ ΔΕΝ ΕΙΝΑΙ ΚΕΝΗ: το ανεβασμένο μοντέλο ΦΕΥΓΕΙ, ως μοντέλο', () => {
    // ⚠️ **ΜΙΑ** κλήση: ο γραφέας παράγει **νέο** ταυτοποιητικό σε κάθε πέρασμα, άρα δύο
    //    κλήσεις θα έδιναν δύο μονοπάτια — και η άγκυρα θα κοκκίνιζε για λόγο δικό της.
    const landed = landedModelRecord();
    const sources = publishedAgencyMediaSources([landed]);

    // 🔴 Η μέτρηση του Ο-13 ήταν ακριβώς αυτό το μήκος = 0, ΧΩΡΙΣ καμία άρνηση στο log:
    //    ο ψήστης δεν κλήθηκε ποτέ, γιατί δεν του έφτασε πηγή να αρνηθεί.
    expect(sources).toHaveLength(1);
    expect(sources[0].material).toEqual(MODEL_MATERIAL);
    expect(sources[0].privateStoragePath).toBe(landed.storagePath);
  });

  it('Κ6 — η ΕΞΟΥΣΙΟΔΟΤΗΣΗ γράφεται στη ΓΕΝΝΗΣΗ του εγγράφου, όχι σε δεύτερη πράξη', () => {
    // ⚠️ Ονομάζει **γιατί** περνά το Κ5, ώστε μια μελλοντική αποτυχία να λέει τι έσπασε.
    //    Η ανθρώπινη πράξη είναι ο διάλογος «Δημοσίευση 3D» — στόχος, σήμανση, υπογράφων.
    //    Χωρίς αυτό το πεδίο, η πράξη συνέβαινε και **δεν άφηνε ίχνος** (Ο-13).
    expect(landedModelRecord().classification).toBe('public');
  });
});
