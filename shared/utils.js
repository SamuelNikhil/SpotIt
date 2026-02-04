/**
 * Shared Utilities for SpotIt
 */

/**
 * Simple sanitization to prevent XSS and keep names clean
 * Strips HTML tags and limits length/characters
 */
export const sanitizeInput = (text, maxLength = 12) => {
  if (typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>?/gm, "") // Strip HTML tags
    .replace(/[^\w\s-]/gi, "") // Allow only alphanumeric, spaces, and hyphens
    .trim()
    .substring(0, maxLength);
};
