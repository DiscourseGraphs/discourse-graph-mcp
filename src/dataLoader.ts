/**
 * Data Loader
 *
 * Parses the JSON-LD file and builds searchable indexes.
 * The data comes from the Akamatsu lab's Roam Research discourse graph.
 */

import * as fs from "fs";
import {
  DiscourseNode,
  RawJsonLdNode,
  RawRelationDef,
  RawRelationInstance,
  RawNodeSchema,
  RawGraphEntry,
  JsonLdDocument,
  NodeType,
  RelationDef,
  RelationInstance,
  NodeSchema
} from "./types.js";
import { extractImageUrls } from "./imageParser.js";

/**
 * Regex to extract node type from title: [[RES]], [[CON]], etc.
 */
const NODE_TYPE_REGEX = /^\[\[([A-Z]{3})\]\]/;

/**
 * Extract UID from @id field (pages: prefix)
 * Example: "pages:CnOU48Obk" -> "CnOU48Obk"
 */
function extractUid(atId: string): string {
  const match = atId.match(/^pages:(.+)$/);
  return match ? match[1] : atId;
}

/**
 * Extract UID from textRefersToNode entries (page: prefix - singular)
 * Example: "page:CnOU48Obk" -> "CnOU48Obk"
 */
function extractRefUid(ref: string): string {
  const match = ref.match(/^page:(.+)$/);
  return match ? match[1] : ref;
}

/**
 * Type guards for discriminating @graph entries
 */
function isNodeSchema(entry: RawGraphEntry): entry is RawNodeSchema {
  return entry["@type"] === "nodeSchema";
}

function isRelationDef(entry: RawGraphEntry): entry is RawRelationDef {
  return entry["@type"] === "relationDef";
}

function isRelationInstance(entry: RawGraphEntry): entry is RawRelationInstance {
  return entry["@type"] === "relationInstance";
}

function isDiscourseNode(entry: RawGraphEntry): entry is RawJsonLdNode {
  // Regular nodes have a title and are not special types
  return "title" in entry &&
         entry["@type"] !== "nodeSchema" &&
         entry["@type"] !== "relationDef" &&
         entry["@type"] !== "relationInstance";
}

/**
 * Extract node type from title prefix
 * Example: "[[RES]] - The antagonistic force..." -> "RES"
 */
function extractNodeType(title: string): NodeType | null {
  const match = title.match(NODE_TYPE_REGEX);
  if (match) {
    const type = match[1] as NodeType;
    return type;
  }
  return null;
}

/**
 * Remove [[XXX]] - prefix from title to get clean title
 * Example: "[[RES]] - The antagonistic force..." -> "The antagonistic force..."
 */
function cleanTitle(title: string): string {
  return title.replace(/^\[\[[A-Z]{3}\]\]\s*-?\s*/, "").trim();
}

/**
 * Build Roam URL from UID
 */
function buildUrl(uid: string): string {
  return `https://roamresearch.com/#/app/akamatsulab/page/${uid}`;
}

/**
 * Parse raw JSON-LD node into DiscourseNode
 * Uses textRefersToNode for linked references (no regex parsing needed)
 */
function parseNode(raw: RawJsonLdNode): DiscourseNode {
  const uid = extractUid(raw["@id"]);
  // Use textRefersToNode directly instead of regex parsing
  const linkedNodeUids = (raw.textRefersToNode || []).map(extractRefUid);
  return {
    uid,
    nodeType: extractNodeType(raw.title),
    title: raw.title,
    titleClean: cleanTitle(raw.title),
    content: raw.content,
    creator: raw.creator,
    created: raw.created,
    modified: raw.modified,
    linkedNodeUids,
    imageUrls: extractImageUrls(raw.content),
    url: buildUrl(uid)
  };
}

/**
 * Data store with multiple indexes for efficient lookup
 */
export interface DataStore {
  /** Lookup by node UID */
  nodesByUid: Map<string, DiscourseNode>;
  /** Lookup by creator name */
  nodesByCreator: Map<string, DiscourseNode[]>;
  /** All nodes for iteration/search */
  allNodes: DiscourseNode[];
  /** All unique creator names */
  allCreators: string[];
  /** Relation definitions indexed by UID */
  relationDefs: Map<string, RelationDef>;
  /** Relation instances indexed by source node UID */
  relationsBySource: Map<string, RelationInstance[]>;
  /** Relation instances indexed by destination node UID */
  relationsByDestination: Map<string, RelationInstance[]>;
  /** All relation instances */
  allRelations: RelationInstance[];
  /** Node schemas indexed by UID */
  nodeSchemas: Map<string, NodeSchema>;
}

/**
 * Map node schema UID to NodeType
 * Example: "_CLM-node" -> "CLM"
 */
function schemaUidToNodeType(schemaUid: string): NodeType | null {
  const match = schemaUid.match(/^_([A-Z]{3})-node$/);
  if (match) {
    return match[1] as NodeType;
  }
  return null;
}

/**
 * Load and index the JSON-LD data file
 *
 * @param dataPath - Path to the JSON-LD file
 * @returns DataStore with indexed nodes
 */
export function loadData(dataPath: string): DataStore {
  // Read and parse the JSON-LD file
  const rawContent = fs.readFileSync(dataPath, "utf-8");
  const jsonLd: JsonLdDocument = JSON.parse(rawContent);

  // Initialize indexes for nodes
  const nodesByUid = new Map<string, DiscourseNode>();
  const nodesByCreator = new Map<string, DiscourseNode[]>();
  const allNodes: DiscourseNode[] = [];

  // Initialize indexes for relationships
  const relationDefs = new Map<string, RelationDef>();
  const relationsBySource = new Map<string, RelationInstance[]>();
  const relationsByDestination = new Map<string, RelationInstance[]>();
  const allRelations: RelationInstance[] = [];

  // Initialize indexes for node schemas
  const nodeSchemas = new Map<string, NodeSchema>();

  // First pass: collect node schemas and relation definitions
  // (needed to resolve labels before processing instances)
  for (const entry of jsonLd["@graph"]) {
    if (isNodeSchema(entry)) {
      const uid = extractUid(entry["@id"]);
      const schema: NodeSchema = {
        uid,
        label: entry.label,
        nodeType: schemaUidToNodeType(uid)
      };
      nodeSchemas.set(uid, schema);
    } else if (isRelationDef(entry)) {
      const uid = extractUid(entry["@id"]);
      const domainUid = extractUid(entry.domain);
      const rangeUid = extractUid(entry.range);
      // Skip duplicates (same @id can appear multiple times)
      if (!relationDefs.has(uid)) {
        const relDef: RelationDef = {
          uid,
          label: entry.label,
          domainUid,
          rangeUid,
          domainLabel: "", // Will be resolved after all schemas are loaded
          rangeLabel: ""
        };
        relationDefs.set(uid, relDef);
      }
    }
  }

  // Resolve domain/range labels for relation definitions
  for (const relDef of relationDefs.values()) {
    const domainSchema = nodeSchemas.get(relDef.domainUid);
    const rangeSchema = nodeSchemas.get(relDef.rangeUid);
    relDef.domainLabel = domainSchema?.label || relDef.domainUid;
    relDef.rangeLabel = rangeSchema?.label || relDef.rangeUid;
  }

  // Second pass: process nodes and relation instances
  for (const entry of jsonLd["@graph"]) {
    if (isDiscourseNode(entry)) {
      const node = parseNode(entry);

      // Index by UID
      nodesByUid.set(node.uid, node);

      // Index by creator
      const creatorNodes = nodesByCreator.get(node.creator) || [];
      creatorNodes.push(node);
      nodesByCreator.set(node.creator, creatorNodes);

      // Add to all nodes array
      allNodes.push(node);
    } else if (isRelationInstance(entry)) {
      const predicateUid = extractUid(entry.predicate);
      const sourceUid = extractUid(entry.source);
      const destinationUid = extractUid(entry.destination);

      // Lookup the relation definition to get the label
      const relDef = relationDefs.get(predicateUid);
      const label = relDef?.label || "unknown";

      const relation: RelationInstance = {
        predicateUid,
        sourceUid,
        destinationUid,
        label
      };

      // Index by source
      const sourceRelations = relationsBySource.get(sourceUid) || [];
      sourceRelations.push(relation);
      relationsBySource.set(sourceUid, sourceRelations);

      // Index by destination
      const destRelations = relationsByDestination.get(destinationUid) || [];
      destRelations.push(relation);
      relationsByDestination.set(destinationUid, destRelations);

      // Add to all relations
      allRelations.push(relation);
    }
  }

  // Get unique creator names
  const allCreators = Array.from(nodesByCreator.keys()).sort();

  return {
    nodesByUid,
    nodesByCreator,
    allNodes,
    allCreators,
    relationDefs,
    relationsBySource,
    relationsByDestination,
    allRelations,
    nodeSchemas
  };
}
