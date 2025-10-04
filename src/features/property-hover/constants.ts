export const statusConfig = {
  'for-sale': { label: 'Προς Πώληση', color: 'bg-green-100 text-green-900 border-green-200', priceLabel: 'Τιμή Πώλησης' },
  'for-rent': { label: 'Προς Ενοικίαση', color: 'bg-blue-100 text-blue-900 border-blue-200', priceLabel: 'Μηνιαίο Μίσθωμα' },
  'sold': { label: 'Πουλημένο', color: 'bg-red-100 text-red-900 border-red-200', priceLabel: 'Τιμή Πώλησης' },
  'rented': { label: 'Ενοικιασμένο', color: 'bg-orange-100 text-orange-900 border-orange-200', priceLabel: 'Μηνιαίο Μίσθωμα' },
  'reserved': { label: 'Δεσμευμένο', color: 'bg-yellow-100 text-yellow-900 border-yellow-200', priceLabel: 'Τιμή Πώλησης' },
  'Άγνωστο': { label: 'Άγνωστο', color: 'bg-gray-100 text-gray-900 border-gray-200', priceLabel: 'Τιμή' },
} as const;
