"use client";

export function getToggleTocAriaLabel(isTocVisible: boolean): string {
  return isTocVisible ? "Απόκρυψη πίνακα περιεχομένων" : "Εμφάνιση πίνακα περιεχομένων";
}
