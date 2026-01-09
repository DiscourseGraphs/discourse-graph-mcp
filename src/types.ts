/**
 * Type definitions for the Discourse Graph MCP Server
 *
 * The discourse graph contains research nodes from the Akamatsu lab
 * on cellular biophysics (endocytosis, membrane tension, actin dynamics).
 */

// Node types in the discourse graph - extracted from [[XXX]] prefix in titles
export type NodeType = "RES" | "QUE" | "CON" | "EVD" | "CLM" | "HYP" | "ISS" | "ART" | "PTN" | "THE";

// All valid node type values for validation
export const VALID_NODE_TYPES: NodeType[] = ["RES", "QUE", "CON", "EVD", "CLM", "HYP", "ISS", "ART", "PTN", "THE"];

/**
 * Parsed and indexed discourse node
 * This is the internal representation after processing the raw JSON-LD
 */
export interface DiscourseNode {
  uid: string;              // e.g., "CnOU48Obk" (extracted from @id)
  nodeType: NodeType | null; // Extracted from [[XXX]] title prefix
  title: string;            // Full original title
  titleClean: string;       // Title without [[TYPE]] prefix
  content: string;          // Full markdown content
  creator: string;          // e.g., "Matt Akamatsu"
  created: string;          // ISO date string
  modified: string;         // ISO date string
  linkedNodeUids: string[]; // UIDs extracted from wikilinks in content
  imageUrls: string[];      // Firebase Storage URLs for figures/diagrams
  url: string;              // Roam URL for this node
}

/**
 * Raw JSON-LD node from the data file
 */
export interface RawJsonLdNode {
  "@id": string;
  "@type": string;
  title: string;
  content: string;
  modified: string;
  created: string;
  creator: string;
  textRefersToNode?: string[];  // e.g., ["page:7oWbeD59y"] - explicit linked references
}

/**
 * Raw relation definition from JSON-LD (defines relationship types)
 */
export interface RawRelationDef {
  "@id": string;
  "@type": "relationDef";
  domain: string;      // e.g., "pages:_EVD-node"
  range: string;       // e.g., "pages:_CLM-node"
  label: string;       // e.g., "Supports"
}

/**
 * Raw relation instance from JSON-LD (actual relationship between nodes)
 */
export interface RawRelationInstance {
  "@type": "relationInstance";
  predicate: string;   // references a relationDef @id, e.g., "pages:WRCE-4nr9"
  source: string;      // e.g., "pages:gr9lwGbRH"
  destination: string; // e.g., "pages:jU5-zu5Yd"
}

/**
 * Raw node schema from JSON-LD (defines node types like Claim, Evidence, etc.)
 */
export interface RawNodeSchema {
  "@id": string;
  "@type": "nodeSchema";
  label: string;       // e.g., "Claim"
  content: string;
  modified: string;
  created: string;
  creator: string;
}

/**
 * Processed relation definition
 */
export interface RelationDef {
  uid: string;         // Extracted from @id
  label: string;       // e.g., "Supports"
  domainUid: string;   // Schema UID for source node type
  rangeUid: string;    // Schema UID for destination node type
  domainLabel: string; // e.g., "Evidence"
  rangeLabel: string;  // e.g., "Claim"
}

/**
 * Processed relation instance
 */
export interface RelationInstance {
  predicateUid: string;    // UID of the relationDef
  sourceUid: string;       // UID of source node
  destinationUid: string;  // UID of destination node
  label: string;           // e.g., "Supports" (resolved from predicate)
}

/**
 * Processed node schema
 */
export interface NodeSchema {
  uid: string;         // e.g., "_CLM-node"
  label: string;       // e.g., "Claim"
  nodeType: NodeType | null;  // Mapped to NodeType if applicable
}

/**
 * Union type for all raw graph entries
 */
export type RawGraphEntry = RawJsonLdNode | RawRelationDef | RawRelationInstance | RawNodeSchema;

/**
 * JSON-LD document structure
 */
export interface JsonLdDocument {
  "@context": Record<string, string>;
  "@id": string;
  "@graph": RawGraphEntry[];
}

/**
 * Schema information for node types
 */
export interface NodeTypeSchema {
  label: string;
  description: string;
}

/**
 * Node type schemas - these explain what each type means
 * This is returned by the get_schema tool
 */
export const NODE_TYPE_SCHEMAS: Record<NodeType, NodeTypeSchema> = {
  RES: {
    label: "Result",
    description: "Specific experimental or simulation observation with methodology context"
  },
  QUE: {
    label: "Question",
    description: "Open research question the lab is investigating"
  },
  CON: {
    label: "Conclusion",
    description: "Interpretation or synthesis drawn from multiple results"
  },
  EVD: {
    label: "Evidence",
    description: "a specific empirical observation from a particular study"
  },
  CLM: {
    label: "Claim",
    description: "atomic, generalized assertions about the world that (propose to) answer research questions"
  },
  HYP: {
    label: "Hypothesis",
    description: "Testable prediction with rationale"
  },
  ISS: {
    label: "Issue",
    description: "Project task or analysis to be done"
  },
  ART: {
    label: "Artifact",
    description: "specific concrete systems (prototypes, standards, etc.) that instantiate one or more conceptual patterns or methods"
  },
  PTN: {
    label: "Pattern",
    description: "conceptual classes such as theoretical objects, heuristics, design patterns, and system/methodological approaches, that are abstracted from a *specific* implementation. They are what make specific systems 'work' or not, matched to a model of the problem."
  },
  THE: {
    label: "Theory",
    description: "high-level, abstracted explanations of phenomena that unify multiple patterns and/or artifacts. can consist of systems of claims."
  }

};
