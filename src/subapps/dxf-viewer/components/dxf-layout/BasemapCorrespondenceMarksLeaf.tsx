'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — ΔΙΑΒΑΣΕ ADR-040 ΠΡΙΝ ΑΛΛΑΞΕΙΣ
 *
 * ADR-782 §27.4 — **τα ορατά σημάδια της αντιστοίχισης υποβάθρου.**
 *
 * ## Το ελάττωμα που κλείνει
 * Το εργαλείο `match` ζωγράφιζε **τίποτα**: ούτε το σημείο σχεδίου που μόλις δείχτηκε, ούτε τα
 * ολοκληρωμένα ζεύγη. Το πάνελ δήλωνε **πλήθος**, ποτέ **πού**. Πάνω σε ράστερ χάρτη λίγα
 * εικονοστοιχεία είναι **μέτρα** — και το `drag` του **ίδιου** εργαλείου έχει συνεχή ανάδραση
 * (πυξίδα). Η ασυμμετρία ήταν η απόδειξη.
 *
 * ## ADR-040 — γιατί ΔΥΟ components και όχι ένα
 * Τα σημάδια είναι αγκυρωμένα στον **κόσμο**, άρα κινούνται με pan/zoom ⇒ χρειάζονται
 * `transform`, που είναι **υψηλής συχνότητας**. Αν το διάβαζε ο `BasemapPlacementLeaf`, θα
 * ξανααποδιδόταν **ολόκληρη** η επιφάνεια — μαζί με το πάνελ και τη λαβή στροφής — σε κάθε
 * καρέ συρσίματος. Έτσι: ο **εξωτερικός** κρίνει αν υπάρχει κάτι να ζωγραφιστεί (μηδέν
 * συνδρομές)· ο **εσωτερικός** προσαρτάται μόνο τότε και είναι ο μόνος που ακούει το
 * `transform`. Ίδιο πρότυπο gate-at-mount με το {@link BasePointPickMarkerOverlay}.
 *
 * ## Γιατί ζει ΜΕΣΑ στην επιφάνεια τοποθέτησης και όχι στην ομάδα των 2Δ overlays
 * Η ορατότητα των σημαδιών εξαρτάται από τις **τρεις πύλες** της τοποθέτησης (ενεργή συνεδρία
 * · κατάσταση «κατά προσέγγιση» · προβολή 2Δ). Στην ομάδα των overlays θα έπρεπε να
 * ξαναγραφτούν — δεύτερη αυθεντία για το ίδιο ερώτημα, που θα απέκλινε στην πρώτη αλλαγή. Εδώ
 * η γονική `return null` **είναι** η πύλη.
 *
 * ## Η αναγνωσιμότητα: casing, ΠΟΤΕ απόχρωση
 * Το σημάδι κάθεται πάνω σε ράστερ που **δεν ελέγχουμε** — φωτεινό ακόμη και στο σκοτεινό
 * θέμα. Καμία τιμή χρώματος δεν λύνει αυτό (ADR-771 Φ.3: το χειρότερο γκρι δίνει 4,58:1 στο
 * καλύτερό του άκρο). Λύνεται όπως στη **χαρτογραφία**: δική μας πένα από κάτω, στο αντίθετο
 * άκρο του μελανιού ⇒ τοπικά 21:1 ανεξάρτητα από το πλακίδιο.
 *
 * ⚠️ Το casing παίρνει **το ίδιο** `strokeDasharray` με το μελάνι. Ένα συμπαγές casing κάτω από
 * διάστικτο τετράγωνο θα γέμιζε τα κενά και θα κατέστρεφε **το ίδιο το μοτίβο** που ξεχωρίζει
 * το εκκρεμές από το ολοκληρωμένο — δηλαδή θα «διόρθωνε» την αντίθεση σβήνοντας πληροφορία.
 * Το ίδιο μάθημα είναι γραμμένο στο `strokeWithContrastCasing` για τον καμβά 2Δ.
 *
 * ## Προσβασιμότητα
 * Το `<svg>` είναι `aria-hidden`: η **πληροφορία** («πόσες αντιστοιχίες», «τι να κάνεις τώρα»,
 * «οι δύο δεν απέχουν το ίδιο») ανακοινώνεται ήδη ως **κείμενο** από το `BasemapPlacementPanel`.
 * Ό,τι προσθέτει αυτό το επίπεδο είναι **θέση σε εικονοστοιχεία**, που δεν είναι πράξιμη από
 * αναγνώστη οθόνης. Μια δεύτερη εκφώνηση του ίδιου πλήθους θα ήταν θόρυβος, όχι πρόσβαση.
 *
 * @see ./basemap-correspondence-marks.ts — η γεωμετρία (καθαρή)
 * @see ../../config/color-config.ts — `BASEMAP_CORRESPONDENCE_MARKS`, το λεξιλόγιο (SSoT)
 */

import React from 'react';
import { BASEMAP_CORRESPONDENCE_MARKS } from '../../config/color-config';
import { maxContrastInk } from '../../config/adaptive-entity-color';
import { CONTRAST_CASING_EXTRA_WIDTH_PX } from '../../bim/renderers/bim-contrast-casing';
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import type { Viewport } from '../../rendering/types/Types';
import type { GeoReference } from '../../systems/geo-referencing/geo-transform';
import type { BasemapPlacementSession } from '../../systems/basemap/basemap-placement-session';
import {
  hasCorrespondenceMarks,
  planCorrespondenceMarks,
  type BasemapMarkStateKey,
  type PlannedMark,
  type PlannedResidual,
} from './basemap-correspondence-marks';

const MARKS = BASEMAP_CORRESPONDENCE_MARKS;

/**
 * Το χρώμα διάσωσης: το **αντίθετο άκρο του μελανιού**, από το ίδιο SSoT που χρησιμοποιεί το
 * casing του καμβά 2Δ. Μηδέν νέα μαθηματικά, και αδύνατο να αποκλίνει από εκείνο.
 *
 * ⚠️ Εδώ εφαρμόζεται **πάντα**, ενώ το `contrastCasingInk` το εφαρμόζει **μόνο σε `shortfall`**.
 * Δεν είναι ασυνέπεια: εκείνο **μέτρησε** την επιφάνεια και ξέρει αν χρειάζεται· εδώ η
 * επιφάνεια είναι πλακίδιο χάρτη, δηλαδή **αυθαίρετη κατά κατασκευή**. Το `unmeasurable` του
 * `adaptive-entity-color` σημαίνει «δεν κατάφερα να μετρήσω» (ύποπτη είσοδος)· εδώ ξέρουμε ότι
 * **δεν υπάρχει τι να μετρηθεί** — η ίδια περίπτωση που η τεκμηρίωση του Mapbox ονομάζει
 * *«when you can't be certain of what's in the background»*.
 */
const CASING_INK = maxContrastInk(MARKS.hex);

/** Το μοτίβο γραμμής μιας κατάστασης, ή `undefined` για συμπαγή. */
function dashOf(state: BasemapMarkStateKey): string | undefined {
  return MARKS.states[state].dash === 'dashed' ? MARKS.pendingDashPx.join(' ') : undefined;
}

interface StrokeProps {
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly strokeDasharray: string | undefined;
}

/**
 * Το **σχήμα** μιας κατάστασης — τετράγωνο ή κύκλος, από το πεδίο `shape` του λεξιλογίου.
 *
 * 🔑 Ο ζωγράφος **δεν ξέρει** ποια κατάσταση είναι ποια: διαβάζει το ίδιο πεδίο που κρίνει η
 * πύλη (CHECK 3.41). Μια χωριστή απόφαση εδώ θα μπορούσε να βάψει δύο τετράγωνα ενώ το
 * λεξιλόγιο δηλώνει τετράγωνο και κύκλο, και η πύλη θα έμενε πράσινη πάνω στο ελάττωμα.
 */
const MarkShape: React.FC<{ readonly mark: PlannedMark } & StrokeProps> = ({ mark, ...pen }) => {
  const x = Number(mark.x.toFixed(1));
  const y = Number(mark.y.toFixed(1));
  if (MARKS.states[mark.state].shape === 'circle') {
    return <circle cx={x} cy={y} r={MARKS.circleRadiusPx} fill="none" {...pen} />;
  }
  const half = MARKS.squareHalfPx;
  return (
    <rect x={x - half} y={y - half} width={2 * half} height={2 * half} fill="none" {...pen} />
  );
};

/** Casing από κάτω, μελάνι από πάνω — **ίδια** γεωμετρία, **ίδιο** μοτίβο (δες κεφαλίδα). */
const CasedMark: React.FC<{ readonly mark: PlannedMark }> = ({ mark }) => {
  const strokeDasharray = dashOf(mark.state);
  return (
    // Το `data-mark-state` ονομάζει **ποια** κατάσταση ζωγραφίζεται· το `tagName` του παιδιού
    // λέει **τι** ζωγραφίστηκε. Οι άγκυρες ρωτούν και τα δύο μαζί — έτσι μια απόκλιση ανάμεσα
    // στο λεξιλόγιο και τη ζωγραφιά είναι ορατή, αντί να κρύβεται πίσω από ένα από τα δύο.
    <g data-mark-state={mark.state}>
      <MarkShape
        mark={mark}
        stroke={CASING_INK}
        strokeWidth={MARKS.strokeWidthPx + CONTRAST_CASING_EXTRA_WIDTH_PX}
        strokeDasharray={strokeDasharray}
      />
      <MarkShape
        mark={mark}
        stroke={MARKS.hex}
        strokeWidth={MARKS.strokeWidthPx}
        strokeDasharray={strokeDasharray}
      />
    </g>
  );
};

/**
 * Η γραμμή του υπολοίπου: **ίδιο** casing, γιατί κάθεται στο ίδιο αυθαίρετο ράστερ.
 * Είναι ό,τι το QGIS δείχνει σε πίνακα — εδώ πάνω στο σημείο που το παράγει.
 */
const CasedResidual: React.FC<{ readonly residual: PlannedResidual }> = ({ residual }) => {
  const ends = {
    x1: residual.from.x.toFixed(1),
    y1: residual.from.y.toFixed(1),
    x2: residual.to.x.toFixed(1),
    y2: residual.to.y.toFixed(1),
  };
  return (
    <g>
      <line {...ends} stroke={CASING_INK} strokeWidth={MARKS.strokeWidthPx + CONTRAST_CASING_EXTRA_WIDTH_PX} />
      <line {...ends} stroke={MARKS.hex} strokeWidth={MARKS.strokeWidthPx} />
    </g>
  );
};

/** Απόσταση της ετικέτας από το κέντρο του σημαδιού, σε px οθόνης. */
const LABEL_OFFSET_PX = MARKS.circleRadiusPx + 3;

/**
 * Η σειρά της αντιστοιχίας (πρακτική QGIS: αριθμημένο κάθε σημείο ελέγχου).
 *
 * Ζωγραφίζεται **μία φορά ανά ζεύγος**, στο σημείο του **σχεδίου**: εκείνο δείχνει ο χρήστης
 * πρώτο, άρα εκεί ζει η ταυτότητα του ζεύγους στη ροή του. Δύο ετικέτες για τον ίδιο αριθμό θα
 * ήταν δύο ονόματα για ένα πράγμα.
 *
 * Το `paintOrder="stroke"` είναι το casing του κειμένου: η πένα βάφεται **κάτω** από το γέμισμα
 * — η ίδια αρχή με τα σχήματα, με τον μηχανισμό που δίνει το SVG για γλυφή.
 */
const OrdinalLabel: React.FC<{ readonly mark: PlannedMark }> = ({ mark }) => (
  <text
    x={(mark.x + LABEL_OFFSET_PX).toFixed(1)}
    y={(mark.y - LABEL_OFFSET_PX).toFixed(1)}
    fontSize={12}
    fontWeight={700}
    paintOrder="stroke"
    stroke={CASING_INK}
    strokeWidth={3}
    fill={MARKS.hex}
  >
    {mark.ordinal}
  </text>
);

interface MarksProps {
  readonly session: BasemapPlacementSession;
  readonly geo: GeoReference;
  readonly viewport: Viewport;
}

/**
 * Ο **εσωτερικός**: ο μόνος που ακούει το `transform`. Προσαρτάται μόνο όταν υπάρχει κάτι να
 * ζωγραφιστεί, άρα η υψίσυχνη συνδρομή κοστίζει **μόνο** όσο κρατά η αντιστοίχιση.
 */
const CorrespondenceMarksInner: React.FC<MarksProps> = ({ session, geo, viewport }) => {
  const transform = useTransformValue();
  const plan = planCorrespondenceMarks(session, geo, transform, viewport);

  return (
    // 🔴 Το `data-basemap-marks` ΔΕΝ είναι διακοσμητικό, και το επέβαλε **ζωντανή μέτρηση**: η
    // πραγματική σελίδα του θεατή έχει **127** `svg[aria-hidden]` (κάθε εικονίδιο lucide είναι
    // ένα) με **59** ξένα `<line>` μέσα τους. Μια άγκυρα που ρωτά «γραμμές σε aria-hidden svg»
    // μετράει εικονίδια εργαλειοθήκης — δηλαδή είναι πράσινη ή κόκκινη για λόγο που δεν έχει
    // σχέση με τα σημάδια. Η ταυτότητα της επιφάνειας πρέπει να είναι **ρητή**.
    <svg
      data-basemap-marks=""
      className="absolute inset-0 size-full pointer-events-none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {plan.residuals.map((residual) => (
        <CasedResidual key={`r${residual.ordinal}`} residual={residual} />
      ))}
      {plan.marks.map((mark) => (
        <CasedMark key={`${mark.state}${mark.ordinal ?? 'p'}`} mark={mark} />
      ))}
      {plan.marks
        .filter((mark) => mark.state === 'drawingSettled' && mark.ordinal !== null)
        .map((mark) => (
          <OrdinalLabel key={`l${mark.ordinal}`} mark={mark} />
        ))}
    </svg>
  );
};

/**
 * Ο **εξωτερικός**: μηδέν συνδρομές, μόνο η ερώτηση «υπάρχει κάτι να ζωγραφιστεί;».
 *
 * ⚠️ Η πύλη είναι πραγματική και όχι βελτιστοποίηση: χωρίς αυτήν, ένα `<svg>` θα έμενε
 * προσαρτημένο πάνω από τον καμβά σε **κάθε** συνεδρία τοποθέτησης — και μαζί του μια
 * συνδρομή στο `transform` που θα ξανααπέδιδε σε κάθε καρέ **συρσίματος**, δηλαδή ακριβώς εκεί
 * που δεν υπάρχει τίποτα να δείξει.
 */
export const BasemapCorrespondenceMarksLeaf: React.FC<MarksProps> = (props) => {
  // ⚠️ Το ΙΔΙΟ κατηγόρημα που χρησιμοποιεί ο σχεδιαστής — δες `hasCorrespondenceMarks` για το
  // γιατί δεν ξαναγράφεται εδώ (μια μετάλλαξη το απέδειξε: δύο αντίγραφα ⇒ πράσινες άγκυρες).
  if (!hasCorrespondenceMarks(props.session)) return null;
  return <CorrespondenceMarksInner {...props} />;
};
