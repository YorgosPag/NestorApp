/**
 * @fileoverview **Η ρίζα ενός πακέτου όπως τη λύνει η Node** — κοινή για τα βήματα που συμπληρώνουν το standalone του Next με
 * αρχεία που δεν βλέπει ο ιχνηλάτης (ADR-884 Φ2ζ ζ4 · ADR-923 §5.5.1).
 *
 * Επιστρέφει την **πραγματική** διαδρομή, όχι το symlink: με το pnpm `node-linker=isolated` το πακέτο ζει κάτω από το `.pnpm`.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

/**
 * @param {string} name το όνομα του πακέτου
 * @param {string} from ο φάκελος από τον οποίο λύνεται
 * @param {string} [entry] τι να λυθεί, όταν το `main` του πακέτου δεν υπάρχει εκεί (το standalone κρατά μόνο όσα ιχνηλατήθηκαν)
 */
function packageRoot(name, from, entry = name) {
  const resolved = createRequire(path.join(from, 'noop.js')).resolve(entry);
  let dir = path.dirname(resolved);
  while (!fs.existsSync(path.join(dir, 'package.json')) || JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).name !== name) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`package root of ${name} not found from ${resolved}`);
    dir = parent;
  }
  return fs.realpathSync(dir);
}

module.exports = { packageRoot };
