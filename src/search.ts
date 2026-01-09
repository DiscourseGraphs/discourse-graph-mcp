/**
 * Search Implementation
 *
 * BM25-based search across discourse nodes.
 * Ranks results by relevance using term frequency and inverse document frequency.
 */

import { DiscourseNode, NodeType } from "./types.js";
import { DataStore } from "./dataLoader.js";

// BM25 parameters
const K1 = 1.5;  // Term frequency saturation (1.2-2.0 typical)
const B = 0.75;  // Length normalization (0.75 typical)
const TITLE_BOOST = 2.0;  // Boost for matches in title

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
  score?: number;
}

/**
 * BM25 Index for efficient search
 */
export interface BM25Index {
  /** Document frequencies: term -> number of docs containing term */
  docFreq: Map<string, number>;
  /** Average document length */
  avgDocLength: number;
  /** Total number of documents */
  numDocs: number;
  /** Tokenized documents: uid -> {terms, length, titleTerms} */
  docs: Map<string, { terms: Map<string, number>; length: number; titleTerms: Map<string, number>; titleLength: number }>;
}

/** Cached BM25 index */
let bm25Index: BM25Index | null = null;

/**
 * Tokenize text into lowercase terms
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1);
}

/**
 * Count term frequencies in a list of tokens
 */
function countTerms(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

/**
 * Build BM25 index from data store
 */
export function buildBM25Index(dataStore: DataStore): BM25Index {
  const docFreq = new Map<string, number>();
  const docs = new Map<string, { terms: Map<string, number>; length: number; titleTerms: Map<string, number>; titleLength: number }>();
  let totalLength = 0;

  for (const node of dataStore.allNodes) {
    // Tokenize content and title separately
    const contentTokens = tokenize(node.content);
    const titleTokens = tokenize(node.title);
    const allTokens = [...contentTokens, ...titleTokens];

    const terms = countTerms(allTokens);
    const titleTerms = countTerms(titleTokens);

    // Update document frequencies
    const uniqueTerms = new Set(allTokens);
    for (const term of uniqueTerms) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }

    docs.set(node.uid, {
      terms,
      length: allTokens.length,
      titleTerms,
      titleLength: titleTokens.length
    });
    totalLength += allTokens.length;
  }

  return {
    docFreq,
    avgDocLength: totalLength / dataStore.allNodes.length,
    numDocs: dataStore.allNodes.length,
    docs
  };
}

/**
 * Compute BM25 score for a document given query terms
 */
function computeBM25Score(
  index: BM25Index,
  docData: { terms: Map<string, number>; length: number; titleTerms: Map<string, number>; titleLength: number },
  queryTerms: string[]
): number {
  let score = 0;

  for (const term of queryTerms) {
    const docFreq = index.docFreq.get(term) || 0;
    if (docFreq === 0) continue;

    // IDF component
    const idf = Math.log((index.numDocs - docFreq + 0.5) / (docFreq + 0.5) + 1);

    // Term frequency in document
    const tf = docData.terms.get(term) || 0;
    if (tf === 0) continue;

    // BM25 term score with length normalization
    const lengthNorm = 1 - B + B * (docData.length / index.avgDocLength);
    const tfScore = (tf * (K1 + 1)) / (tf + K1 * lengthNorm);

    score += idf * tfScore;

    // Title boost: add extra score for title matches
    const titleTf = docData.titleTerms.get(term) || 0;
    if (titleTf > 0) {
      score += idf * TITLE_BOOST;
    }
  }

  return score;
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
 * Search nodes by keyword with BM25 ranking
 *
 * @param dataStore - The data store with indexed nodes
 * @param query - Search query string
 * @param nodeType - Optional filter by node type
 * @param creator - Optional filter by creator name
 * @param limit - Maximum results to return (default 10)
 * @param index - Optional pre-built BM25 index
 * @returns Array of matching search results, ranked by relevance
 */
export function searchNodes(
  dataStore: DataStore,
  query: string,
  nodeType?: NodeType,
  creator?: string,
  limit: number = 10,
  index?: BM25Index
): SearchResult[] {
  // Build or use cached index
  if (!index) {
    if (!bm25Index) {
      bm25Index = buildBM25Index(dataStore);
    }
    index = bm25Index;
  }

  // Tokenize query
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return [];
  }

  // Score all nodes
  const scoredResults: { node: DiscourseNode; score: number }[] = [];

  for (const node of dataStore.allNodes) {
    // Apply filters first
    if (nodeType && node.nodeType !== nodeType) continue;
    if (creator && !node.creator.toLowerCase().includes(creator.toLowerCase())) continue;

    const docData = index.docs.get(node.uid);
    if (!docData) continue;

    const score = computeBM25Score(index, docData, queryTerms);
    if (score > 0) {
      scoredResults.push({ node, score });
    }
  }

  // Sort by score descending
  scoredResults.sort((a, b) => b.score - a.score);

  // Limit and transform to SearchResult
  return scoredResults.slice(0, limit).map(({ node, score }) => ({
    uid: node.uid,
    nodeType: node.nodeType,
    title: node.titleClean,
    creator: node.creator,
    created: node.created,
    snippet: createSnippet(node.content),
    imageCount: node.imageUrls.length,
    score: Math.round(score * 100) / 100
  }));
}
