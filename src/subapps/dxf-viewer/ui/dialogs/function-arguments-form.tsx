'use client';

/**
 * ADR-763 §16 — **η όψη** του διαλόγου «Ορίσματα συνάρτησης». Χωρίς store και χωρίς i18n:
 * όλα τα κείμενα φτάνουν έτοιμα, όπως και στον διάλογο της Φάσης 1.
 *
 * ## Η διάταξη ΕΙΝΑΙ η προδιαγραφή, και έχει τρία επίπεδα εξήγησης
 * Από πάνω προς τα κάτω: **τι κάνει η συνάρτηση** (σταθερό), **τι είναι το όρισμα που
 * αγγίζεις τώρα** (αλλάζει με το `Tab`), **τι βγαίνει στο τέλος** (αλλάζει με ό,τι γράφεις).
 * Δεν είναι τρεις παραλλαγές του ίδιου κειμένου· είναι τρεις **διαφορετικές** ερωτήσεις που
 * ο χρήστης κάνει με αυτή τη σειρά, και το Excel τις απαντά ακριβώς έτσι εδώ και δεκαετίες.
 *
 * ## Γιατί `<fieldset>` + `<legend>` για το όνομα της συνάρτησης
 * Το Excel ζωγραφίζει πλαίσιο ομάδας με τον τίτλο πάνω στη γραμμή του — που είναι κυριολεκτικά
 * η εγγενής εμφάνιση του `<fieldset>`. Το κέρδος δεν είναι αισθητικό: τα κουτιά ορισμάτων
 * **είναι** ομάδα πεδίων που ανήκουν σε μία κλήση, και ο αναγνώστης οθόνης ανακοινώνει το
 * όνομα της συνάρτησης πριν από κάθε πεδίο χωρίς να χρειαστεί ούτε ένα `aria-*`.
 *
 * @module subapps/dxf-viewer/ui/dialogs/function-arguments-form
 * @see function-argument-rows.tsx — οι σειρές
 * @see docs/centralized-systems/reference/adrs/ADR-763-table-insert-function-dialog.md §16
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  ArgumentPreview,
  FunctionArgumentField,
  FunctionArgumentRows,
  type FunctionArgumentRow,
  type FunctionArgumentToggleLabels,
} from './function-argument-rows';
import type { InsertFunctionFrame } from './insert-function-form';

export interface FunctionArgumentsFormLabels {
  readonly title: string;
  readonly close: string;
  readonly ok: string;
  readonly cancel: string;
  readonly result: string;
  readonly helpLink: string;
  readonly noArguments: string;
  /** Το `⬆`/`⬇` κάθε σειράς — δες τη σύμπτυξη παρακάτω. */
  readonly toggle: FunctionArgumentToggleLabels;
}

export interface FunctionArgumentsFormProps {
  readonly labels: FunctionArgumentsFormLabels;
  readonly frame: InsertFunctionFrame;
  /** Το όνομα της συνάρτησης — γίνεται `<legend>`. */
  readonly functionName: string;
  readonly rows: readonly FunctionArgumentRow[];
  readonly activeIndex: number;
  /**
   * 🔴 Φ2.4 — σε ποιο όρισμα είναι **μαζεμένη** η κάρτα· `null` = αναπτυγμένη. Παράγωγο του
   * store (`collapsedFunctionArgumentIndex`), ώστε η όψη να μη γνωρίζει τη διάζευξη «μόνιμη
   * σύμπτυξη ή σύρση σε εξέλιξη;» — δύο αντίγραφά της θα απέκλιναν.
   */
  readonly collapsedIndex: number | null;
  readonly onValueChange: (index: number, value: string) => void;
  readonly onFocus: (index: number) => void;
  readonly onToggleCollapse: (index: number) => void;
  /** Τι κάνει η συνάρτηση. `''` για τις μη τεκμηριωμένες — δες `documented`. */
  readonly description: string;
  /** Η ετικέτα του **εστιασμένου** ορίσματος, έντονη πριν την επεξήγησή του. */
  readonly activeArgumentName: string;
  /** Η επεξήγηση του εστιασμένου ορίσματος. `''` όταν δεν υπάρχει γραμμένη. */
  readonly activeArgumentHelp: string;
  /** Η αποτίμηση της **κλήσης** (ADR-763 Φ2.3). `''` όσο δεν υπάρχει απάντηση. */
  readonly callPreview: string;
  /** Η αποτίμηση **ολόκληρου** του τύπου του κελιού (Φ2.3). Δες γιατί είναι δύο, στο §17. */
  readonly resultPreview: string;
  /** Τεκμηρίωση της συνάρτησης εκτός εφαρμογής· `''` όταν δεν έχει νόημα να προσφερθεί. */
  readonly helpHref: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** `false` όσο λείπει υποχρεωτικό όρισμα με **δηλωμένη** υποχρεωτικότητα. */
  readonly canConfirm: boolean;
}

/**
 * 🔴 Φ2.4 — **δύο μορφές, ένα παράθυρο.**
 *
 * Η συμπτυγμένη λωρίδα δεν είναι «η ίδια κάρτα με κρυμμένα κομμάτια»: είναι άλλο περιεχόμενο
 * (ένα πεδίο, καμία εξήγηση, κανένα κουμπί) στην **ίδια θέση**. Γραμμένη με `display: none`
 * πάνω στην πλήρη, θα κρατούσε ζωντανά τα υπόλοιπα κουτιά — δηλαδή το `autoFocus` και το
 * `Tab` θα ταξίδευαν σε πεδία που ο χρήστης **δεν βλέπει**.
 *
 * Η θέση και το σύρσιμο μένουν **κοινά** (το ίδιο `frame`), γιατί η κάρτα δεν μετακόμισε —
 * μάζεψε. Ο χρήστης που τη σέρνει μαζεμένη τη βρίσκει εκεί όταν ανοίξει.
 */
export function FunctionArgumentsForm(props: FunctionArgumentsFormProps): React.ReactElement {
  const collapsedRow = props.collapsedIndex === null
    ? undefined
    : props.rows[props.collapsedIndex];
  // Ο δείκτης μπορεί να δείχνει σε σειρά που **έπαψε να υπάρχει** (ο χρήστης έσβησε το
  // περιεχόμενο και η λίστα μάζεψε). Η κάρτα ανοίγει, αντί να ζωγραφίσει λωρίδα χωρίς πεδίο.
  if (props.collapsedIndex === null || collapsedRow === undefined) {
    return <ExpandedArgumentsCard {...props} />;
  }
  return <CollapsedArgumentsCard {...props} index={props.collapsedIndex} row={collapsedRow} />;
}

/**
 * Η **συμπτυγμένη** λωρίδα: μία σειρά, ώστε ο πίνακας από πίσω να είναι ολόκληρος ορατός.
 *
 * Το `role="dialog"` και το `aria-label` μένουν **τα ίδια**: για τον αναγνώστη οθόνης δεν
 * άνοιξε νέο παράθυρο — το ίδιο άλλαξε μορφή.
 */
function CollapsedArgumentsCard(
  props: FunctionArgumentsFormProps & { readonly index: number; readonly row: FunctionArgumentRow },
): React.ReactElement {
  const { labels, frame, index, row } = props;
  return (
    <section
      className={cn(
        'dxf-fn-args-card',
        'dxf-fn-args-card--collapsed',
        frame.isDragging && 'dxf-fn-args-card--dragging',
      )}
      role="dialog"
      aria-modal="false"
      aria-label={labels.title}
      style={{ left: frame.position.x, top: frame.position.y }}
    >
      {/* Η λαβή είναι **ρητή** και όχι ολόκληρη η λωρίδα: το πεδίο κειμένου καταλαμβάνει σχεδόν
          όλο το πλάτος, και μια λωρίδα-λαβή θα έκανε την επιλογή κειμένου με το ποντίκι να
          σέρνει το παράθυρο. */}
      <span
        className="dxf-fn-args-grip"
        aria-hidden="true"
        onMouseDown={frame.onDragStart}
      >
        ⠿
      </span>
      <FunctionArgumentField
        index={index}
        row={row}
        focused
        collapsed
        toggleLabels={labels.toggle}
        onValueChange={props.onValueChange}
        onFocus={props.onFocus}
        onToggleCollapse={props.onToggleCollapse}
      />
      {/* 🔑 **Πιο πλούσιο από το Excel, επίτηδες**: εκεί η λωρίδα δείχνει μόνο τη διεύθυνση.
          Ο χρήστης όμως σέρνει **επειδή** δεν είναι σίγουρος ποια περιοχή θέλει — η τιμή που
          μεγαλώνει όσο σέρνει είναι η μόνη απάντηση στο «σωστή περιοχή;», και η μόνη στιγμή
          που δεν μπορεί να τη δει είναι ακριβώς αυτή. Ίδιο component με τη λίστα, μία φορά. */}
      <ArgumentPreview row={row} />
    </section>
  );
}

function ExpandedArgumentsCard(props: FunctionArgumentsFormProps): React.ReactElement {
  const { labels, frame, functionName, rows, activeIndex } = props;

  return (
    <section
      className={cn('dxf-fn-args-card', frame.isDragging && 'dxf-fn-args-card--dragging')}
      role="dialog"
      // Δες τη Φάση 1: όχι modal, γιατί ο χρήστης οφείλει να αγγίζει τον πίνακα από πίσω —
      // εδώ μάλιστα είναι ο **μηχανισμός**, αφού τα εύρη επιλέγονται με το ποντίκι.
      aria-modal="false"
      aria-label={labels.title}
      // Ίδια, ρητή εξαίρεση στον N.3 με τη Φάση 1: η θέση προέρχεται από χειρονομία δείκτη.
      style={{ left: frame.position.x, top: frame.position.y }}
    >
      <header className="dxf-fn-args-header" onMouseDown={frame.onDragStart}>
        <h2 className="dxf-fn-args-title">{labels.title}</h2>
        <button
          type="button"
          className="dxf-fn-args-close"
          aria-label={labels.close}
          onClick={props.onCancel}
        >
          ✕
        </button>
      </header>

      <fieldset className="dxf-fn-args-group">
        <legend className="dxf-fn-args-legend">{functionName}</legend>
        <FunctionArgumentRows
          rows={rows}
          activeIndex={activeIndex}
          toggleLabels={labels.toggle}
          onValueChange={props.onValueChange}
          onFocus={props.onFocus}
          onToggleCollapse={props.onToggleCollapse}
          emptyLabel={labels.noArguments}
        />
      </fieldset>

      <FunctionArgumentsExplanations {...props} />
      <FunctionArgumentsActions {...props} />
    </section>
  );
}

/** Τα τρία επίπεδα εξήγησης της κεφαλίδας, με τη σειρά που τα ρωτά ο χρήστης. */
function FunctionArgumentsExplanations(props: FunctionArgumentsFormProps): React.ReactElement {
  const { labels, description, activeArgumentName, activeArgumentHelp } = props;
  return (
    <>
      {/* Η αποτίμηση της κλήσης κάθεται δεξιά, ακριβώς κάτω από τη στήλη των τιμών: είναι η
          ίδια στήλη πληροφορίας, ένα επίπεδο πιο έξω. */}
      <p className="dxf-fn-args-call">{props.callPreview === '' ? '' : `= ${props.callPreview}`}</p>
      <p className="dxf-fn-args-description">{description}</p>
      <p className="dxf-fn-args-arghelp">
        {activeArgumentHelp === '' ? '' : (
          <>
            <strong className="dxf-fn-args-arghelp-name">{`${activeArgumentName}:`}</strong>
            {` ${activeArgumentHelp}`}
          </>
        )}
      </p>
      <p className="dxf-fn-args-result">
        {labels.result}
        {props.resultPreview === '' ? '' : ` ${props.resultPreview}`}
      </p>
    </>
  );
}

/**
 * Ο σύνδεσμος βοήθειας και τα δύο κουμπιά.
 *
 * ⚠️ Ο σύνδεσμος είναι `<a>` με `target="_blank"` **και** `rel="noopener noreferrer"`: χωρίς
 * το `noopener`, η σελίδα που ανοίγει αποκτά `window.opener` προς την εφαρμογή.
 */
function FunctionArgumentsActions(props: FunctionArgumentsFormProps): React.ReactElement {
  const { labels, helpHref, onConfirm, onCancel, canConfirm } = props;
  return (
    <footer className="dxf-fn-args-actions">
      {helpHref === '' ? <span /> : (
        <a
          className="dxf-fn-args-help-link"
          href={helpHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {labels.helpLink}
        </a>
      )}
      <span className="dxf-fn-args-buttons">
        <button
          type="button"
          className="dxf-modal-button dxf-modal-button-primary"
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          {labels.ok}
        </button>
        <button type="button" className="dxf-modal-button" onClick={onCancel}>
          {labels.cancel}
        </button>
      </span>
    </footer>
  );
}
