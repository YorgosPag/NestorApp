/**
 * =============================================================================
 * MASK EMAIL — SSoT PII masker for diagnostic scripts
 * =============================================================================
 *
 * Masks an email for secure logging: "user@example.com" → "u***@e***.com".
 * Shared by every diagnostic/audit script that prints user data
 * (check-user-claims.js, audit-missing-auth-claims.js, …) so the masking rule
 * lives in exactly one place.
 *
 * @module scripts/_shared/mask-email
 */

/**
 * @param {string|null|undefined} email
 * @returns {string} Masked email, or a placeholder when unmaskable.
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return '(none)';
  }

  const atIndex = email.indexOf('@');
  if (atIndex < 1) {
    return '***';
  }

  const local = email.substring(0, atIndex);
  const domain = email.substring(atIndex + 1);

  if (!domain || domain.length < 1) {
    return `${local[0]}***@***`;
  }

  const dotIndex = domain.lastIndexOf('.');
  if (dotIndex < 1) {
    return `${local[0]}***@***`;
  }

  const domainName = domain.substring(0, dotIndex);
  const tld = domain.substring(dotIndex + 1);

  if (!domainName || !tld) {
    return `${local[0]}***@***`;
  }

  return `${local[0]}***@${domainName[0]}***.${tld}`;
}

module.exports = { maskEmail };
