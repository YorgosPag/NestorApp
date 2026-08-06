'use client';

/**
 * @fileoverview Η ζωντανή διαδρομή: σκηνή → Λ1 → στιγμιότυπο βάσης → Λ2 (ADR-745 Φ3β).
 *
 * 🔴 **Διαβάζει. Δεν γράφει — ποτέ, με κανέναν τρόπο.** Το `getAllContacts` είναι ανάγνωση, και
 * είναι η **μόνη** επαφή αυτού του hook με το Firestore. Η εγγραφή ζει αποκλειστικά πίσω από το
 * κουμπί έγκρισης· ένα `useEffect` που θα «προ-εφάρμοζε» μια βέβαιη πρόταση θα ήταν παραβίαση της
 * θεμελιώδους αρχής του ADR (§5.1) και το πιάνει ο κατάσκοπος εγγραφής, όχι αυτό το σχόλιο.
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/useTitleBlockProposals
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllContacts } from '@/services/contacts-query.service';
import { resolveContactDisplayName } from '@/services/contacts/ContactNameResolver';
import { readProjectSnapshot } from '@/services/title-block-apply/project-snapshot';
import { listSurveyRecords } from '@/services/survey-record.service';
import { surveyRecordLabel } from '@/lib/survey-record/survey-record-label';
import { resolveTitleBlockProposals } from '@/lib/title-block/title-block-proposals';
import { resolveDocumentBodyProposals } from '@/lib/title-block/resolve-document-body';
import { readDocumentBodies } from '@/lib/document-body/read-document-body';
import type { DocumentBodyReading } from '@/types/document-body-reading';
import type { ContactSnapshotEntry } from '@/lib/title-block/resolve-people';
import type { SurveySnapshot } from '@/lib/title-block/resolve-survey-record';
import type { SurveyRecord } from '@/types/project-survey-record';
import type { BindingProposal } from '@/types/title-block-binding';
import {
  scanTitleBlockLayers,
  type TitleBlockLayerScan,
} from '../../../text-engine/title-block/reading/scene-title-block-cells';
import { collectDocumentSources } from '../../../text-engine/document-body/scene-document-bodies';
import { useLevelScene } from '../../../systems/scene/useSceneSelectors';

/**
 * Ανώτατο πλήθος επαφών του στιγμιότυπου.
 *
 * ⚠️ Το `getAllContacts` **δεν έχει κανένα εξ ορισμού όριο**: χωρίς αυτό, μια ανάγνωση πινακίδας
 * θα κατέβαζε ολόκληρη τη συλλογή επαφών του μισθωτή. Το όριο **δηλώνεται** στο αποτέλεσμα
 * (`truncated`) ώστε ένα «δεν βρέθηκε» να μην μπορεί να σημαίνει σιωπηλά «δεν κοίταξα όλους».
 */
const CONTACT_SNAPSHOT_LIMIT = 1000;

export interface TitleBlockProposalsState {
  readonly loading: boolean;
  readonly scan: TitleBlockLayerScan | null;
  /** Το layer που εξετάζεται — ο πρώτος υποψήφιος, ή ό,τι διάλεξε ο άνθρωπος. */
  readonly selectedLayerId: string | null;
  readonly proposals: readonly BindingProposal[];
  /**
   * Οι προτάσεις που γεννούν τα **έγγραφα** του σχεδίου — χωριστά από της πινακίδας.
   *
   * 🔴 **Χωριστά επίτηδες** (ADR-759 §4.6): η πινακίδα έχει δομή, το σώμα είναι πρόζα, και ο
   * μηχανικός πρέπει να ξέρει ποια από τις δύο κοιτάζει **πριν** πατήσει Έγκριση. Ενωμένες σε
   * μία λίστα, οι δύο ποιότητες θα φαίνονταν ίδιες.
   */
  readonly bodyProposals: readonly BindingProposal[];
  /** Τα έγγραφα που βρέθηκαν — και **τι ρώτησαν και έμεινε κενό** (`emptySections`). */
  readonly documentBodies: readonly DocumentBodyReading[];
  /**
   * Τα τοπογραφικά του έργου. `undefined` όσο δεν έχουν απαντήσει — η παλέτα το δείχνει ως
   * φόρτωση, ποτέ ως «δεν υπάρχει».
   */
  readonly survey: SurveySnapshot | undefined;
  /** Το στιγμιότυπο κόπηκε στο όριο ⇒ «δεν βρέθηκε» δεν είναι εξαντλητικό. */
  readonly truncated: boolean;
  readonly error: string | null;
}

/**
 * `SurveyRecord[]` → η ελάχιστη προβολή που χρειάζεται η **απόφαση προορισμού**.
 *
 * Το `label` χτίζεται από το κοινό `surveyRecordLabel` — το ίδιο που δείχνει η καρτέλα, ώστε
 * το όνομα που διαβάζει ο μηχανικός εδώ να είναι **το ίδιο** που θα ψάξει εκεί.
 */
function toSurveySnapshot(
  records: readonly SurveyRecord[],
  activeId: string | null,
): SurveySnapshot {
  return {
    records: records.map((record) => ({
      id: record.id,
      isConfirmed: record.confirmedBy !== null,
      label: surveyRecordLabel(record),
    })),
    activeId,
  };
}

/** `Contact` → η ελάχιστη προβολή που χρειάζεται το ταίριασμα. */
function toSnapshot(contact: { id: string }): ContactSnapshotEntry {
  const raw = contact as Record<string, unknown>;
  const phones = (raw.phones as { number?: string }[] | undefined) ?? [];
  const emails = (raw.emails as { email?: string }[] | undefined) ?? [];
  return {
    id: contact.id,
    displayName: resolveContactDisplayName(contact as never) ?? '',
    phones: phones.map((p) => p.number ?? '').filter(Boolean),
    emails: emails.map((e) => e.email ?? '').filter(Boolean),
  };
}

export interface UseTitleBlockProposalsParams {
  readonly levelId: string | null;
  readonly projectId?: string;
  /** Ζητείται μόνο όταν η παλέτα είναι ανοιχτή — κλειστή παλέτα δεν διαβάζει τη βάση. */
  readonly enabled: boolean;
}

export function useTitleBlockProposals(
  params: UseTitleBlockProposalsParams,
): TitleBlockProposalsState & {
  selectLayer: (layerId: string) => void;
  /** Ξαναδιαβάζει τις επαφές και **επαναϋπολογίζει** τις προτάσεις από τον ίδιο Λ2. */
  refresh: () => void;
} {
  const { levelId, projectId, enabled } = params;
  const scene = useLevelScene(levelId);

  const [contacts, setContacts] = useState<readonly ContactSnapshotEntry[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosenLayerId, setChosenLayerId] = useState<string | null>(null);
  const requestSeq = useRef(0);

  /**
   * Ένας μετρητής που **ζητά** νέο στιγμιότυπο επαφών — δεν κρατά δεδομένα.
   *
   * 🔴 **Γιατί μετρητής και όχι «πρόσθεσε τη νέα επαφή στη λίστα».** Το ADR-759 §4.5 το λέει
   * ρητά: *«δεν μαντεύουμε το `contactId`, το ξαναπερνάμε από τον ίδιο Λ2. Ένα μονοπάτι, όχι
   * δύο.»* Σπρώχνοντας τη νεογέννητη επαφή απευθείας στο `contacts`, το ταίριασμα θα γινόταν
   * πάνω σε ό,τι **νομίζαμε** ότι γράψαμε — και το `name-exact` θα ήταν εγγυημένο **εξ
   * ορισμού**, δηλαδή θα έπαυε να αποδεικνύει οτιδήποτε. Έτσι, αν το όνομα αποθηκεύτηκε
   * διαφορετικά απ' ό,τι διαβάστηκε, η γραμμή **παραμένει** `no-match` και φαίνεται.
   */
  const [refreshSeq, setRefreshSeq] = useState(0);
  const refresh = useCallback(() => setRefreshSeq((n) => n + 1), []);

  /**
   * Έχει το έργο κύρια διεύθυνση; **`undefined` όσο δεν ξέρουμε — ποτέ `false` από άγνοια.**
   *
   * 🔴 Γεννά το `no-primary-address` **πριν** το κλικ (ADR-759 §4.4): ο φύλακας υπήρχε ήδη στο
   * `apply-project-value.ts:65`, αλλά μιλούσε **μετά**, όταν ο άνθρωπος είχε ήδη πατήσει
   * Έγκριση σε πρόταση που η εφαρμογή ήξερε ότι θα αποτύχει.
   *
   * ⚠️ **Το `catch` αφήνει `undefined`, δεν βάζει `false`.** Αποτυχία δικτύου θα βαφόταν
   * «το έργο δεν έχει διεύθυνση» — λάθος συμπέρασμα με σωστή μορφή, ακριβώς το σχήμα που το
   * παρακάτω `catch` των επαφών υπάρχει για να αποτρέψει (§9.5).
   *
   * 🔑 Ίδια διαδρομή ανάγνωσης με την **εγγραφή** (`readProjectSnapshot` → `GET /api/projects`,
   * ADR-742): δεύτερο direct Firestore read θα ήταν δεύτερο μοντέλο ασφαλείας για την ίδια
   * ερώτηση.
   */
  const [hasPrimaryAddress, setHasPrimaryAddress] = useState<boolean | undefined>(undefined);

  /**
   * Τα τοπογραφικά του έργου — ο **προορισμός** των δηλώσεων του τοπογράφου (ADR-759 Φ3γ).
   *
   * 🔴 **Δύο αναγνώσεις, μία απάντηση, και οι δύο είναι απαραίτητες.** Η λίστα λέει *πόσα
   * υπάρχουν και ποια είναι παγωμένα*· το έργο λέει *ποιο ισχύει*. Με μόνο τη λίστα, το
   * «ποιο ισχύει» θα προέκυπτε από ταξινόμηση — ακριβώς αυτό που απαγορεύει το ADR-759 Q1.
   *
   * ⚠️ **Αποτυχία ⇒ κενό στιγμιότυπο, ΟΧΙ `undefined`.** Είναι διαφορετική επιλογή από το
   * `hasPrimaryAddress` από πάνω, και σκόπιμα: εκεί το `undefined` σημαίνει «μη μπλοκάρεις»,
   * γιατί ο πραγματικός φύλακας ζει στο κλικ. Εδώ **δεν υπάρχει τιμή που να επιτρέπει
   * συνέχεια** — χωρίς `recordId` δεν χτίζεται στόχος. Άρα η ίδια σύμβαση με τις **επαφές**:
   * το σφάλμα γίνεται ορατό (`error`) και ο χρήστης βλέπει «δεν υπάρχει καρτέλα», με το
   * μήνυμα αποτυχίας από πάνω — ποτέ γραμμή που εξαφανίζεται σιωπηλά.
   */
  const [survey, setSurvey] = useState<SurveySnapshot | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !projectId) {
      setHasPrimaryAddress(undefined);
      setSurvey(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const snapshot = await readProjectSnapshot(projectId);
        if (!cancelled) setHasPrimaryAddress(snapshot.addresses.some((a) => a.isPrimary));
        const records = await listSurveyRecords(projectId);
        if (!cancelled) setSurvey(toSurveySnapshot(records, snapshot.activeSurveyRecordId));
      } catch (cause) {
        if (cancelled) return;
        setHasPrimaryAddress(undefined);
        setSurvey({ records: [], activeId: null });
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, projectId, refreshSeq]);

  useEffect(() => {
    if (!enabled) return;
    const seq = ++requestSeq.current;
    let cancelled = false;
    void (async () => {
      try {
        const result = await getAllContacts({ limitCount: CONTACT_SNAPSHOT_LIMIT });
        if (cancelled || seq !== requestSeq.current) return;
        setContacts(result.contacts.map(toSnapshot));
        setTruncated(result.contacts.length >= CONTACT_SNAPSHOT_LIMIT);
        setError(null);
      } catch (cause) {
        if (cancelled || seq !== requestSeq.current) return;
        // Η αποτυχία **μιλάει**: σιωπηλό `catch` εδώ θα εμφανιζόταν ως «δεν βρέθηκε καμία
        // επαφή» — δηλαδή λάθος συμπέρασμα με σωστή μορφή (ADR-745 §9.5, ίδιο σχήμα).
        setError(cause instanceof Error ? cause.message : String(cause));
        setContacts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, refreshSeq]);

  const scan = useMemo(() => {
    if (!enabled || !scene) return null;
    return scanTitleBlockLayers(scene.entities, scene.layersById);
  }, [enabled, scene]);

  const selectedLayerId = chosenLayerId ?? scan?.candidates[0]?.layerId ?? null;

  /**
   * Τα έγγραφα του σχεδίου.
   *
   * ⚠️ **Δεν φιλτράρεται layer**: ποιο κείμενο είναι έγγραφο το λέει ο **τίτλος** του, και το
   * μετρημένο εύρημα είναι ότι τα τέσσερα έγγραφα του G753 ζουν σε **δύο** layers ενώ το ένα
   * από αυτά τα layers έχει 77 κείμενα θορύβου (ADR-759 §4.6).
   */
  const documentBodies = useMemo(() => {
    if (!enabled || !scene) return [];
    return readDocumentBodies(collectDocumentSources(scene.entities, scene.layersById));
  }, [enabled, scene]);

  const proposals = useMemo(() => {
    if (!scan || !contacts || !levelId) return [];
    const layer = scan.candidates.find((c) => c.layerId === selectedLayerId);
    if (!layer) return [];
    return resolveTitleBlockProposals(layer.readings, {
      projectId,
      levelId,
      contacts,
      ...(hasPrimaryAddress !== undefined ? { hasPrimaryAddress } : {}),
      ...(survey ? { survey } : {}),
    });
  }, [scan, contacts, levelId, projectId, selectedLayerId, hasPrimaryAddress, survey]);

  const bodyProposals = useMemo(() => {
    if (documentBodies.length === 0) return [];
    return resolveDocumentBodyProposals(documentBodies, {
      ...(projectId ? { projectId } : {}),
      ...(hasPrimaryAddress !== undefined ? { hasPrimaryAddress } : {}),
      ...(survey ? { survey } : {}),
    });
  }, [documentBodies, projectId, hasPrimaryAddress, survey]);

  return {
    // 🔴 Το `survey` **μπαίνει στην πύλη φόρτωσης**, σε αντίθεση με το `hasPrimaryAddress`.
    // Χωρίς αυτό, το πρώτο καρέ θα υπολόγιζε προτάσεις με κενό στιγμιότυπο και θα έγραφε
    // «το έργο δεν έχει τοπογραφικό» — σωστό μήνυμα, λάθος στιγμή, και ο μηχανικός θα το
    // διάβαζε πριν προλάβει να έρθει η απάντηση.
    loading: enabled && (contacts === null || scan === null || (projectId !== undefined && survey === undefined)),
    scan,
    selectedLayerId,
    survey,
    proposals,
    bodyProposals,
    documentBodies,
    truncated,
    error,
    selectLayer: setChosenLayerId,
    refresh,
  };
}
