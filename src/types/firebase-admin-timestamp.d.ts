// Augments @google-cloud/firestore Timestamp to be structurally compatible
// with the @firebase/firestore client SDK Timestamp. The client Timestamp has:
//   - toJSON() returning { seconds, nanoseconds, type: string }
//   - toString() returning string
// Both are missing from the admin declaration but present at runtime.
declare module '@google-cloud/firestore' {
  interface Timestamp {
    toJSON(): { seconds: number; nanoseconds: number; type: string };
    toString(): string;
  }
}
