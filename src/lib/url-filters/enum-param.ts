/**
 * URL enum-param SSoT — μία παράμετρος query με **κλειστό** σύνολο τιμών και μία προεπιλογή.
 *
 * Το σχήμα «προβολή στο URL» (`?view=map` · `?view=floorplan`): άγνωστη ή απούσα τιμή ⇒ η προεπιλογή, ποτέ
 * σφάλμα (ο σύνδεσμος μπορεί να είναι παλιός)· η προεπιλογή **σβήνει** το κλειδί, ώστε η ίδια οθόνη να έχει
 * **μία** διεύθυνση.
 *
 * 🔑 Εξήχθη από το `lib/list-map/list-map-view` όταν απέκτησε δεύτερο καταναλωτή (ADR-840 §7.7, η προβολή της
 *    «Διαθέσιμα Ακίνητα»). Δύο χειρόγραφα αντίγραφα θα διαφωνούσαν στην πρώτη αλλαγή — π.χ. αν το ένα άρχιζε να
 *    γράφει την προεπιλογή και το άλλο όχι.
 *
 * @module lib/url-filters/enum-param
 * @see ADR-840 §7.7 · ADR-777 §8.75 · ADR-896
 */

export interface UrlEnumParamSpec<V extends string> {
  /** Το κλειδί του query string — δημόσιο συμβόλαιο: ταξιδεύει σε κάθε κοινοποιημένο σύνδεσμο. */
  readonly param: string;
  /** Το κλειστό σύνολο τιμών. */
  readonly values: readonly V[];
  /** Η τιμή όταν το κλειδί λείπει ή είναι άγνωστο — **δεν** γράφεται ποτέ στο URL. */
  readonly fallback: V;
}

export interface UrlEnumParam<V extends string> extends UrlEnumParamSpec<V> {
  readonly is: (value: unknown) => value is V;
  readonly parse: (params: URLSearchParams) => V;
  /** Μεταλλάσσει τα params επί τόπου — σχήμα του `replaceUrlSearchParams`. */
  readonly write: (value: V, params: URLSearchParams) => void;
}

export function urlEnumParam<V extends string>(spec: UrlEnumParamSpec<V>): UrlEnumParam<V> {
  const is = (value: unknown): value is V =>
    typeof value === 'string' && (spec.values as readonly string[]).includes(value);

  return {
    ...spec,
    is,
    parse: (params) => {
      const raw = params.get(spec.param);
      return is(raw) ? raw : spec.fallback;
    },
    write: (value, params) => {
      if (value === spec.fallback) params.delete(spec.param);
      else params.set(spec.param, value);
    },
  };
}
