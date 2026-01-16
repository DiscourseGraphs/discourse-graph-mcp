/**
 * Search Implementation
 *
 * Simple keyword-based search across discourse nodes.
 * Matches all query words against title and content.
 */

import { DiscourseNode, NodeType } from "./types.js";
import { DataStore } from "./dataLoader.js";

/**
 * Search result with summary information
 */
export interface SearchResult {
  uid: string;
  nodeType: NodeType | null;
  title: string;
  creator: string;
  created: string;
  snippet: string;
  imageCount: number;
}

/**
 * Create a snippet from content for search results
 *
 * Removes markdown frontmatter and truncates to reasonable length.
 *
 * @param content - The full markdown content
 * @param maxLength - Maximum snippet length (default 200)
 * @returns Truncated content snippet
 */
function createSnippet(content: string, maxLength: number = 200): string {
  // Remove markdown/frontmatter header if present
  let cleanContent = content.replace(/^---[\s\S]*?---\n?/, "").trim();

  // Remove markdown image syntax to keep snippet clean
  cleanContent = cleanContent.replace(/!\[.*?\]\(.*?\)/g, "[image]");

  // Remove excessive whitespace
  cleanContent = cleanContent.replace(/\s+/g, " ");

  // Truncate and add ellipsis if needed
  if (cleanContent.length > maxLength) {
    cleanContent = cleanContent.substring(0, maxLength).trim() + "...";
  }

  return cleanContent;
}

/**
 * Check if a node matches all query words
 *
 * @param node - The node to check
 * @param queryWords - Array of lowercase query words
 * @returns True if all words appear in title or content
 */
function matchesQuery(node: DiscourseNode, queryWords: string[]): boolean {
  const searchableText = `${node.title} ${node.content}`.toLowerCase();
  return queryWords.every(word => searchableText.includes(word));
}

/**
 * Search nodes by keyword with optional filters
 *
 * @param dataStore - The data store with indexed nodes
 * @param query - Search query string
 * @param nodeType - Optional filter by node type
 * @param creator - Optional filter by creator name
 * @param orderBy - Optional field to sort by (created, modified, title)
 * @param sortDirection - Sort direction (asc or desc, default desc)
 * @param limit - Maximum results to return (default 10)
 * @returns Array of matching search results
 */
export function searchNodes(
  dataStore: DataStore,
  query: string,
  nodeType?: NodeType,
  creator?: string,
  orderBy?: "created" | "modified" | "title",
  sortDirection: "asc" | "desc" = "desc",
  limit: number = 10
): SearchResult[] {
  // Parse query into lowercase words
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 0);

  // Filter nodes
  let results = dataStore.allNodes
    // Filter by query words
    .filter(node => matchesQuery(node, queryWords))
    // Filter by node type if specified
    .filter(node => !nodeType || node.nodeType === nodeType)
    // Filter by creator if specified (case-insensitive partial match)
    .filter(node =>
      !creator || node.creator.toLowerCase().includes(creator.toLowerCase())
    );

  // Sort results if orderBy is specified
  if (orderBy) {
    results.sort((a, b) => {
      let comparison = 0;

      switch (orderBy) {
        case "created":
        case "modified":
          // Compare dates as strings (ISO format)
          comparison = a[orderBy].localeCompare(b[orderBy]);
          break;
        case "title":
          // Compare titles alphabetically (case-insensitive)
          comparison = a.titleClean.toLowerCase().localeCompare(b.titleClean.toLowerCase());
          break;
      }

      // Apply sort direction
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }

  // Limit results
  results = results.slice(0, limit);

  // Transform to SearchResult
  return results.map(node => ({
    uid: node.uid,
    nodeType: node.nodeType,
    title: node.titleClean,
    creator: node.creator,
    created: node.created,
    snippet: createSnippet(node.content),
    imageCount: node.imageUrls.length
  }));
}
