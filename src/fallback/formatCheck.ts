import type { FormatCheck } from '../types';

export const RFC_MAX_EMAIL = 254;
export const RFC_MAX_LABEL = 63;
// RFC 5321 §4.5.3.1.1: the local-part may be up to 64 octets — one more than a DNS label. Using
// RFC_MAX_LABEL here would wrongly reject a valid 64-character local-part.
export const RFC_MAX_LOCAL = 64;

// ReDoS-safe by construction: no nested quantifiers, and the `.` separator is excluded from the
// char classes, so there is no ambiguous overlap that could cause catastrophic backtracking.
// Combined with the length guards below (the local-part bounded to <= RFC_MAX_LOCAL and each
// domain label to <= RFC_MAX_LABEL), the regex never processes a large or adversarial string.
const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
// Label: starts and ends alphanumeric (no leading/trailing hyphen), bounded length.
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

const SPECIAL_USE_TLDS = new Set(['local', 'localhost', 'internal', 'invalid', 'test', 'example']);

/** Lowercased domain part of an email, or '' when there is no '@'. */
export function extractDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

/**
 * True when the domain is a public, multi-label, non-special-use name worth an MX lookup.
 * NOTE: no Public Suffix List — bare registry suffixes (e.g. co.uk) are treated as public.
 * Documented fidelity limitation; out of scope.
 */
export function isPublicDomain(domain: string): boolean {
  if (!domain || domain.length > RFC_MAX_EMAIL) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false; // single-label / localhost
  if (SPECIAL_USE_TLDS.has(labels[labels.length - 1])) return false;
  return labels.every((l) => l.length > 0 && l.length <= RFC_MAX_LABEL && LABEL.test(l));
}

/**
 * RFC-ish syntactic format check. Length guards run FIRST (cost + ReDoS guard), then the
 * bounded regexes. This is a SYNTACTIC check only: a `valid:true` here means well-formed,
 * NOT deliverable.
 */
export function checkFormat(email: string): FormatCheck {
  if (typeof email !== 'string' || email.length === 0 || email.length > RFC_MAX_EMAIL) {
    return { valid: false, reason: 'invalid_length' };
  }
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return { valid: false, reason: 'invalid_format' };
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > RFC_MAX_LOCAL || !LOCAL.test(local)) return { valid: false, reason: 'invalid_format' };
  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every((l) => l.length <= RFC_MAX_LABEL && LABEL.test(l))) {
    return { valid: false, reason: 'invalid_format' };
  }
  return { valid: true };
}
