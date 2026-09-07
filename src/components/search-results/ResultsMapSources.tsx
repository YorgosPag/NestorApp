'use client';

/**
 * # ΟΙ ΔΥΟ ΠΗΓΕΣ ΤΟΥ ΧΑΡΤΗ — **και γιατί δεν μπορούν να είναι μία** (ADR-777 §8.66)
 *
 * 🔴 **Ο ΛΟΓΟΣ ΕΙΝΑΙ ΠΕΡΙΟΡΙΣΜΟΣ ΤΗΣ ΒΙΒΛΙΟΘΗΚΗΣ, ΚΑΙ ΕΙΝΑΙ ΣΙΩΠΗΛΟΣ.** Το
 * supercluster — η μηχανή ομαδοποίησης που έρχεται μέσα στο `maplibre-gl` — δέχεται
 * **μόνο** `Point`/`MultiPoint`. Μια πηγή με `cluster: true` **αγνοεί** κάθε πολύγωνό
 * της: δεν σκάει, δεν προειδοποιεί, απλώς **δεν το ζωγραφίζει**.
 *
 * ⇒ Ένα σκέτο `cluster: true` πάνω στη μία πηγή θα έσβηνε **κάθε μετρημένο περίγραμμα
 * ακινήτου** — ό,τι **ακριβέστερο** έχει η οθόνη *(Α5)* — αφήνοντας τον χάρτη γεμάτο
 * πινέζες και συσσωματώματα που **μοιάζουν σωστά**.
 *
 * ## 🔑 Η ΚΟΠΗ ΕΙΝΑΙ ΚΑΤΑ ΕΥΘΥΝΗ, ΟΧΙ ΑΡΙΘΜΗΤΙΚΗ
 *
 * Εδώ ζει *«ποιες πηγές υπάρχουν και τι ζωγραφίζει η καθεμία»* — γνώση που αλλάζει
 * όταν αλλάζει **η γεωμετρία των δεδομένων**. Στο `ResultsMap` μένει *«τι κάνει ο
 * χάρτης όταν τον αγγίξεις»*. Είναι η **τρίτη** εξαγωγή από εκείνο το αρχείο με το
 * ίδιο κριτήριο *(§8.63 το σύνορο · §8.65 η ανάγνωση)*, και όχι επειδή μετρήσαμε
 * γραμμές: το `ResultsMap` ήταν στις **483/500** και η δεύτερη πηγή δεν χωρούσε.
 */

import React from 'react';

import { Layer, Source } from '@/lib/maps/maplibre';
import type { ListingFocus } from '@/lib/listings/listing-focus';
import type { SplitListingGeometry } from '@/lib/listings/listings-geojson';
import {
  CLUSTER_KEY,
  CLUSTER_RADIUS,
  CLUSTER_TEXT,
  LISTING_CLUSTER_OPTIONS,
} from '@/lib/maps/listing-clusters';

import { ResultsMapLayers } from './ResultsMapLayers';

/** Η πηγή των **σημείων** — αυτή που ομαδοποιείται. */
export const POINT_SOURCE_ID = 'public-listings';
/**
 * Η πηγή των **πολυγώνων**.
 *
 * ⚠️ **Ξεχωριστό αναγνωριστικό, ποτέ παραλλαγή του πρώτου**: τα `queryRenderedFeatures`
 * του `ResultsMap` ρωτούν **κατά επίπεδο**, όχι κατά πηγή, οπότε ένα κοινό πρόθεμα θα
 * ήταν ευκολία χωρίς κανέναν καταναλωτή.
 */
export const OUTLINE_SOURCE_ID = 'public-listing-outlines';

interface ResultsMapSourcesProps {
  readonly geometry: SplitListingGeometry;
  readonly mark: string;
  readonly surface: string;
  readonly focus: ListingFocus;
}

/**
 * Οι δύο πηγές και τα επίπεδά τους.
 *
 * ⚠️ **Η σειρά απόδοσης ΕΙΝΑΙ η σειρά ζωγραφικής**: τα περιγράμματα μπαίνουν **πρώτα**
 * ώστε οι πινέζες και τα συσσωματώματα να κάθονται **από πάνω** τους. Ένα ακίνητο με
 * μετρημένο σχήμα δεν πρέπει να καλύπτει τον στόχο κλικ ενός γείτονά του.
 */
export function ResultsMapSources({ geometry, mark, surface, focus }: ResultsMapSourcesProps) {
  return (
    <>
      <Source id={OUTLINE_SOURCE_ID} type="geojson" data={geometry.polygons}>
        {/* ΜΕΤΡΗΜΕΝΟ ΠΕΡΙΓΡΑΜΜΑ — πραγματικό σχήμα, γεμάτο + περίγραμμα. */}
        <Layer
          source={OUTLINE_SOURCE_ID}
          id="listing-outline-fill"
          type="fill"
          paint={{ 'fill-color': mark, 'fill-opacity': 0.3 }}
        />
        <Layer
          source={OUTLINE_SOURCE_ID}
          id="listing-outline-line"
          type="line"
          paint={{ 'line-color': mark, 'line-width': 2 }}
        />
      </Source>

      {/*
        ⚠️ **Οι επιλογές ομαδοποίησης απλώνονται από ΜΙΑ σταθερά.** Γραμμένες εδώ ως
        χωριστά props (`cluster` · `clusterRadius` · `clusterMaxZoom` ·
        `clusterProperties`) θα ήταν τέσσερις αποφάσεις σε αρχείο **παρουσίασης**, ενώ
        η έκφραση που τις διαβάζει ζει στο `lib/maps/listing-clusters.ts`. Δύο σπίτια
        για μία απόφαση είναι το σχήμα ADR-749.
      */}
      <Source
        id={POINT_SOURCE_ID}
        type="geojson"
        data={geometry.points}
        {...LISTING_CLUSTER_OPTIONS}
      >
        <ResultsMapLayers
          sourceId={POINT_SOURCE_ID}
          mark={mark}
          surface={surface}
          focus={focus}
        />

        {/*
          ────────────────────────────────────────────────────────────────────
          ΤΟ ΣΥΣΣΩΜΑΤΩΜΑ — **πλήθος, ποτέ τιμή** (ο κανόνας ζει στο SSoT)
          ────────────────────────────────────────────────────────────────────

          🔑 **Το γέμισμα είναι ΑΔΙΑΦΑΝΕΣ, σε αντίθεση με τις σκιάσεις αβεβαιότητας.**
          Η σκίαση λέει *«κάπου εδώ μέσα»* και οφείλει να αφήνει τον χάρτη να φανεί· το
          συσσωμάτωμα λέει *«εδώ ακριβώς, τόσα»* και είναι **στόχος για κλικ**. Δύο
          διαφορετικοί ισχυρισμοί, δύο διαφορετικές υφές — όχι δύο αποχρώσεις του ίδιου
          πράγματος (CHECK 3.41: η διαφορά επιβιώνει χωρίς χρώμα).
        */}
        <Layer
          source={POINT_SOURCE_ID}
          id="listing-cluster"
          type="circle"
          filter={['has', CLUSTER_KEY.pointCount]}
          paint={{
            'circle-radius': CLUSTER_RADIUS,
            'circle-color': mark,
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': surface,
          }}
        />
        <Layer
          source={POINT_SOURCE_ID}
          id="listing-cluster-count"
          type="symbol"
          filter={['has', CLUSTER_KEY.pointCount]}
          layout={{
            'text-field': CLUSTER_TEXT,
            'text-size': 12,
            /*
              ⚠️ **`text-allow-overlap` ΥΠΟΧΡΕΩΤΙΚΟ.** Χωρίς αυτό το MapLibre κρύβει
              ετικέτες που συγκρούονται — δηλαδή ένα συσσωμάτωμα θα ζωγραφιζόταν ως
              **κουκκίδα χωρίς αριθμό**, που είναι χειρότερο από το να μην υπάρχει: ο
              επισκέπτης βλέπει στόχο και δεν ξέρει τι κρύβει.
            */
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          }}
          paint={{ 'text-color': surface }}
        />
      </Source>
    </>
  );
}
