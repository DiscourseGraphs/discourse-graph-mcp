/**
 * Image Parser
 *
 * Extracts Firebase Storage image URLs from discourse node content.
 * The nodes contain figures and diagrams stored in Firebase:
 *
 * ![](https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2Fakamatsulab%2Fixf9qHolHe.png?alt=media&token=...)
 *
 * These URLs are publicly accessible and can be used with Claude's vision capabilities.
 */

/**
 * Extract Firebase Storage image URLs from content
 *
 * Looks for Firebase Storage URLs in markdown image syntax.
 * These URLs are publicly accessible without authentication.
 *
 * @param content - The markdown content to parse
 * @returns Array of unique Firebase Storage URLs found in the content
 */
export function extractImageUrls(content: string): string[] {
  const urls: Set<string> = new Set();

  // Pattern to match Firebase Storage URLs
  // These URLs end at whitespace or closing parenthesis (from markdown syntax)
  const firebaseUrlRegex = /https:\/\/firebasestorage\.googleapis\.com\/[^\s\)]+/g;

  let match;
  while ((match = firebaseUrlRegex.exec(content)) !== null) {
    urls.add(match[0]);
  }

  return Array.from(urls);
}
