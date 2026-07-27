'use client';

/**
 * ADR-650 §M10e — THE PROOF CARD. Why the user should believe the proposed match.
 *
 * The matcher never applies its own answer. This card is the reason that rule is workable:
 * it puts the evidence in front of the engineer — how it matched, on which layer, how many
 * points landed out of how many could, how tightly, and through what rotation — and only then
 * offers the «Εφαρμογή» button. A number that changes `Project.basePoint` for every floor of
 * a building deserves to be seen before it is accepted.
 *
 * A REFUSAL is rendered with the same care as a success. «Δεν βρέθηκε ταύτιση» with no reason
 * teaches the user nothing; a unit mismatch naming the ratio tells them exactly what to fix.
 *
 * Separate file per N.7.1 — `TopoGeoReferenceSection` is already 200+ lines and this is a
 * distinct responsibility (presenting evidence, not orchestrating a workflow).
 *
 * i18n `dxf-viewer-panels` (`topography.geoRef.match.*`), no inline styles, semantic
 * `<section>`/`<dl>` — a term/value list IS a description list.
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import type { GeoMatchMethod, GeoMatchResult } from '../../../systems/geo-referencing/geo-auto-match';
import type { GateFailure } from '../../../systems/geo-referencing/geo-match-gates';
import styles from './TopographyPanel.module.css';

const MM_TO_CM = 0.1;

/**
 * Full i18n keys per method — written out, never assembled from a template literal.
 *
 * Two reasons: a `t(\`…${x}\`)` key is invisible to the static i18n checks (3.8 / 3.13), so a
 * missing translation would only ever surface as a blank label in front of a user; and an
 * exhaustive `Record<GeoMatchMethod, …>` makes adding a method a compile error here rather
 * than a silently unlabelled card.
 */
const METHOD_LABEL_KEY: Readonly<Record<GeoMatchMethod, string>> = {
  'identity-restore': 'topography.geoRef.match.method.identityRestore',
  'already-aligned': 'topography.geoRef.match.method.alreadyAligned',
  'point-number': 'topography.geoRef.match.method.pointNumber',
  'congruent-pairs': 'topography.geoRef.match.method.congruentPairs',
  'unit-mismatch': 'topography.geoRef.match.method.unitMismatch',
  'needs-manual': 'topography.geoRef.match.method.needsManual',
};

/** Explanatory hint per SUCCEEDING method. The two refusals carry their own, more specific text. */
const METHOD_HINT_KEY: Readonly<Partial<Record<GeoMatchMethod, string>>> = {
  'identity-restore': 'topography.geoRef.match.methodHint.identityRestore',
  'already-aligned': 'topography.geoRef.match.methodHint.alreadyAligned',
  'point-number': 'topography.geoRef.match.methodHint.pointNumber',
  'congruent-pairs': 'topography.geoRef.match.methodHint.congruentPairs',
};

export interface TopoGeoMatchResultCardProps {
  readonly result: GeoMatchResult;
  readonly onApply: () => void;
  readonly onDismiss: () => void;
}

type TFn = ReturnType<typeof useTranslation>['t'];

/** One term/value row of the evidence list. */
function ProofRow(props: { readonly term: string; readonly value: string }): React.JSX.Element {
  return (
    <>
      <dt>{props.term}</dt>
      <dd>{props.value}</dd>
    </>
  );
}

/**
 * Which gate refused → its explanation key. Written out for the same reason as the method
 * keys: a template-literal key is invisible to the static i18n checks.
 */
const FAILURE_KEY: Readonly<Record<GateFailure, string>> = {
  'too-few-inliers': 'topography.geoRef.match.failure.tooFewInliers',
  'residual-too-large': 'topography.geoRef.match.failure.residualTooLarge',
  ambiguous: 'topography.geoRef.match.failure.ambiguous',
};

/**
 * The refusal text, as specific as the result allows.
 *
 * «Δεν βρέθηκε ταύτιση» names no next action. When a gate actually refused a candidate, its
 * numbers are shown instead — «12 points where 28 are needed» tells the engineer the two files
 * barely overlap, «ambiguous» tells them the geometry is symmetric and no algorithm can decide
 * for them. The generic text is the fallback for when nothing even got close.
 */
function refusalText(result: GeoMatchResult, t: TFn): string {
  if (result.method === 'unit-mismatch') {
    const scale = result.scaleEstimate.toFixed(result.scaleEstimate >= 100 ? 0 : 4);
    return result.suggestedUnitScale !== null
      ? t('topography.geoRef.match.failure.unitMismatch', { scale })
      : t('topography.geoRef.match.failure.unitMismatchUnknown', { scale });
  }

  if (result.failure === null) return t('topography.geoRef.match.failure.needsManual');
  return t(FAILURE_KEY[result.failure], {
    inliers: result.inliers,
    required: result.required,
    cm: (result.rmsMm * MM_TO_CM).toFixed(1),
  });
}

/** The measured evidence behind an accepted proposal. */
function ProofList(props: { readonly result: GeoMatchResult; readonly t: TFn }): React.JSX.Element {
  const { result, t } = props;
  return (
    <dl className={styles.proofList}>
      <ProofRow
        term={t('topography.geoRef.match.proof.inliers')}
        value={t('topography.geoRef.match.proof.inliersValue', {
          inliers: result.inliers, matchable: result.matchable, required: result.required,
        })}
      />
      <ProofRow
        term={t('topography.geoRef.match.proof.rms')}
        value={t('topography.geoRef.match.proof.rmsValue', { cm: (result.rmsMm * MM_TO_CM).toFixed(1) })}
      />
      <ProofRow
        term={t('topography.geoRef.match.proof.rotation')}
        value={t('topography.geoRef.match.proof.rotationValue', { deg: result.rotationDeg.toFixed(3) })}
      />
      {result.layerName !== null && (
        <ProofRow term={t('topography.geoRef.match.proof.layer')} value={result.layerName} />
      )}
      {result.hypotheses > 0 && (
        <ProofRow
          term={t('topography.geoRef.match.proof.hypotheses')}
          value={t('topography.geoRef.match.proof.hypothesesValue', { count: result.hypotheses })}
        />
      )}
    </dl>
  );
}

export function TopoGeoMatchResultCard(props: TopoGeoMatchResultCardProps): React.JSX.Element {
  const { result, onApply, onDismiss } = props;
  const { t } = useTranslation('dxf-viewer-panels');

  const applicable = result.geo !== null;
  const hintKey = METHOD_HINT_KEY[result.method];
  const hint = hintKey ? t(hintKey) : refusalText(result, t);

  return (
    <section className={`${styles.proofCard} ${applicable ? '' : styles.proofCardRefused}`}>
      <h4 className={styles.label}>{t('topography.geoRef.match.proofTitle')}</h4>
      <p className={styles.status}>
        {`${t('topography.geoRef.match.method.label')}: ${t(METHOD_LABEL_KEY[result.method])}`}
      </p>
      <p className={applicable ? styles.subtitle : `${styles.status} ${styles.statusError}`}>{hint}</p>

      {applicable && <ProofList result={result} t={t} />}

      <div className={styles.row}>
        {applicable && (
          <button type="button" className={styles.generateButton} onClick={onApply}>
            {t('topography.geoRef.match.apply')}
          </button>
        )}
        <button type="button" className={styles.generateButton} onClick={onDismiss}>
          {t('topography.geoRef.match.dismiss')}
        </button>
      </div>
    </section>
  );
}
