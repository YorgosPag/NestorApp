// Augments @google-cloud/firestore Timestamp to be compatible with the client
// SDK Timestamp interface (which requires toJSON). Both admin and client
// Timestamps are structurally identical except for toJSON.
declare module '@google-cloud/firestore' {
  interface Timestamp {
    toJSON(): { seconds: number; nanoseconds: number };
  }
}
