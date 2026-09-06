'use client';

/**
 * @fileoverview **ΤΟ ΚΕΛΥΦΟΣ ΤΩΝ ΔΥΟ ΟΘΟΝΩΝ ΥΛΙΚΟΥ** — σκελετός, ποτέ απόφαση.
 * @related ADR-841 §7 (Α14.7.4 · Α17.7) · ListingMediaOrderPanel · ListingFloorplansPanel
 * @module components/listings/ListingMaterialPanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΞΗΧΘΗ ΠΡΙΝ ΓΡΑΦΤΕΙ Ο ΔΕΥΤΕΡΟΣ ΚΑΤΑΝΑΛΩΤΗΣ, ΟΧΙ ΜΕΤΑ (N.0.2 · N.18)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **Α17.7** γέννησε δεύτερη οθόνη με **ταυτόσημο σκελετό** *(τίτλος · βοήθεια · λίστα με
 * μικρογραφία και όνομα · άδειο μήνυμα · ειδοποίηση αποτυχίας)* και **διαφορετική πράξη**
 * *(«να μπει πρώτη» ⇄ «να φύγει ως κάτοψη»)*. Δύο αρχεία με τον ίδιο σκελετό είναι
 * ακριβώς το **sibling clone** που ο κανόνας **N.18** ονομάζει *«το κλασικό λάθος:
 * κεντρικοποιείς το Α, γράφεις Β ως δίδυμο»*.
 *
 * 🔑 **ΕΔΩ ΖΕΙ ΜΟΝΟ Ο ΣΚΕΛΕΤΟΣ.** Καμία γνώση για σειρά, κατόψεις, φρουρούς ή αγγελίες —
 * ίδιο δόγμα με το `lib/ordering/total-name-order`: *«η μηχανή κοινή, η απόφαση όχι»*.
 * Κάθε οθόνη δίνει **τα δικά της** κλειδιά και **τη δική της** πράξη ως `children`.
 */

import React from 'react';

import { FileThumbnail } from '@/components/shared/files/FileThumbnail';

export interface ListingMaterialPanelProps {
  /** Σταθερό αναγνωριστικό για τον δεσμό `aria-labelledby` — μοναδικό ανά οθόνη. */
  readonly titleId: string;
  readonly title: string;
  readonly help: string;
  /** Τι λέμε όταν δεν υπάρχει τίποτα — **και τι να κάνει ο άνθρωπος**, ποτέ σκέτο «κενό». */
  readonly empty: string;
  /** Μήνυμα αποτυχίας· `null` όσο δεν έχει αποτύχει τίποτα. */
  readonly failure: string | null;
  /** `true` όταν δεν υπάρχει καμία γραμμή — η οθόνη το ρωτά, δεν το μαντεύει από τα children. */
  readonly isEmpty: boolean;
  readonly children: React.ReactNode;
}

/**
 * **Ο σκελετός μιας οθόνης υλικού αγγελίας.**
 *
 * ⚠️ **Το `isEmpty` δίνεται, δεν συμπεραίνεται.** Ένας έλεγχος `React.Children.count`
 * θα ήταν σωστός σήμερα και **σιωπηλά λάθος** την πρώτη φορά που μια οθόνη τυλίξει τις
 * γραμμές της σε fragment ή προσθέσει επικεφαλίδα — δηλαδή θα έδειχνε «καμία» ενώ
 * υπάρχουν.
 */
export function ListingMaterialPanel({
  titleId,
  title,
  help,
  empty,
  failure,
  isEmpty,
  children,
}: ListingMaterialPanelProps) {
  return (
    <section aria-labelledby={titleId} className="mt-6 rounded-lg border border-border p-4">
      <header className="mb-3">
        <h3 id={titleId} className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      </header>

      {/*
        ⚠️ **Το άδειο δεν είναι σφάλμα — είναι απάντηση, και λέει ΤΙ ΝΑ ΚΑΝΕΙ ο άνθρωπος.**
        Ο λόγος που δεν φεύγει τίποτα είναι σχεδόν πάντα ανθρώπινη πράξη που λείπει, και
        αυτό δεν το μαντεύει κανείς κοιτάζοντας μια κενή λίστα.
      */}
      {isEmpty ? <p className="text-xs text-muted-foreground">{empty}</p> : children}

      {/*
        ⚠️ **Η αποτυχία λέγεται, δεν σιωπά** — η οθόνη έχει ήδη γυρίσει πίσω στην κατάσταση
        που πράγματι ισχύει, οπότε χωρίς αυτή τη γραμμή ο άνθρωπος θα έβλεπε το κλικ του
        να «μην κάνει τίποτα» και θα το ξαναπατούσε.
      */}
      {failure !== null && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {failure}
        </p>
      )}
    </section>
  );
}

export interface ListingMaterialRowProps {
  readonly contentType: string;
  readonly thumbnailUrl?: string;
  readonly downloadUrl?: string;
  readonly displayName: string;
  /** Η **πράξη** αυτής της γραμμής — το μόνο που διαφέρει ανάμεσα στις δύο οθόνες. */
  readonly children: React.ReactNode;
}

/**
 * **Μια γραμμή υλικού**: τι είναι, πώς λέγεται, και η πράξη του.
 *
 * ⚠️ **Η μικρογραφία δεν είναι διακόσμηση.** Ο άνθρωπος διαλέγει ανάμεσα σε αρχεία με
 * ονόματα σαν `IMG_20260315_114808.jpg`· χωρίς εικόνα, η οθόνη θα του ζητούσε να
 * αποφασίσει **στα τυφλά** για το τι βλέπει ο κόσμος.
 */
export function ListingMaterialRow({
  contentType,
  thumbnailUrl,
  downloadUrl,
  displayName,
  children,
}: ListingMaterialRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-border p-2">
      <FileThumbnail
        contentType={contentType}
        thumbnailUrl={thumbnailUrl}
        downloadUrl={downloadUrl}
        displayName={displayName}
        size="sm"
      />

      <span className="min-w-0 flex-1 truncate text-xs text-foreground">{displayName}</span>

      {children}
    </li>
  );
}
