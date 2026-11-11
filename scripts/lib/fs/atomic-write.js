'use strict';
/**
 * Ατομική εγγραφή αρχείου: όποιος διαβάζει παράλληλα (άλλος πράκτορας, νήμα του hook,
 * backup) βλέπει το παλιό ή το νέο περιεχόμενο, ποτέ μισό.
 *
 * Προσωρινό αρχείο ΔΙΠΛΑ στον προορισμό (ίδιος τόμος) και `rename`: στον ίδιο τόμο η
 * μετονομασία είναι ατομική και στα Windows και στο POSIX. Το όνομα του προσωρινού έχει
 * το pid, ώστε δύο διεργασίες που γράφουν το ίδιο αρχείο να μη μοιράζονται προσωρινό.
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * @param {string} file προορισμός
 * @param {string | Buffer} data περιεχόμενο (κείμενο ή αυτούσια bytes)
 * @param {{ mtime?: Date }} [options] `mtime`: χρόνος τροποποίησης που κρατά το αρχείο,
 *   γραμμένος στο προσωρινό ΠΡΙΝ τη μετονομασία, ώστε να μην υπάρξει στιγμή με λάθος χρόνο.
 */
function writeFileAtomic(file, data, { mtime } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, data);
    if (mtime) fs.utimesSync(tmp, mtime, mtime);
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, { force: true }); // ούτε μισό προσωρινό δεν μένει πίσω
    throw error;
  }
}

module.exports = { writeFileAtomic };
