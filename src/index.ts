#!/usr/bin/env node
/**
 * Discourse Graph MCP Server
 *
 * An MCP server that exposes the Akamatsu lab's discourse graph on cellular
 * biophysics (endocytosis, membrane tension, actin dynamics) to Claude.
 *
 * The server provides 9 tools:
 * - search_nodes: Full-text search with filters and sorting
 * - get_node: Get complete node details
 * - get_linked_nodes: Graph traversal with typed relationships
 * - get_schema: Return ontology/node types
 * - get_researcher_contributions: Attribution and statistics
 * - get_node_images: Get image URLs for vision interpretation
 * - get_relationships: Query typed relationships (Supports, Informs, Opposes)
 * - get_relation_types: List available relationship type definitions
 * - get_node_neighborhood: K-hop neighborhood traversal with BFS
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

import { loadData, DataStore } from "./dataLoader.js";
import {
  SearchNodesSchema,
  GetNodeSchema,
  GetLinkedNodesSchema,
  GetSchemaSchema,
  GetResearcherContributionsSchema,
  GetNodeImagesSchema,
  GetRelationshipsSchema,
  GetRelationTypesSchema,
  GetNodeNeighborhoodSchema,
  handleSearchNodes,
  handleGetNode,
  handleGetLinkedNodes,
  handleGetSchema,
  handleGetResearcherContributions,
  handleGetNodeImages,
  handleGetRelationships,
  handleGetRelationTypes,
  handleGetNodeNeighborhood,
  TOOL_DEFINITIONS
} from "./tools.js";

// Get directory of this file for relative data path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data path - can be overridden with DATA_PATH env var
const DATA_PATH =
  process.env.DATA_PATH ||
  path.join(__dirname, "..", "plugin-testing-akamatsulab2_query-results_202512231309.json");

/**
 * Derive server name from environment variable or data file path.
 * Priority: 1) SERVER_NAME env var, 2) Dataset prefix from filename
 */
function deriveServerName(dataPath: string): string {
  // Priority 1: Explicit SERVER_NAME env var
  if (process.env.SERVER_NAME && process.env.SERVER_NAME.trim()) {
    return process.env.SERVER_NAME.trim();
  }

  // Priority 2: Extract from filename
  const filename = path.basename(dataPath, '.json');

  // Extract prefix before "_query-results_" or timestamp patterns
  const match = filename.match(/^([^_]+(?:_[^_]+)*?)(?:_query-results_|_\d{12,})?/);

  if (match && match[1]) {
    return `${match[1]}-server`;
  }

  // Fallback: use full filename (minus extension)
  return `${filename}-server`;
}

// Initialize data store (will be populated on startup)
let dataStore: DataStore;

// Derive server name from environment or data path
const SERVER_NAME = deriveServerName(DATA_PATH);

// Create MCP server
const server = new McpServer({
  name: SERVER_NAME,
  version: "0.2.0"
});

// ============================================================================
// Register Tools
// ============================================================================

// Tool: search_nodes
server.tool(
  TOOL_DEFINITIONS.search_nodes.name,
  TOOL_DEFINITIONS.search_nodes.description,
  TOOL_DEFINITIONS.search_nodes.schema.shape,
  async (args) => handleSearchNodes(dataStore, SearchNodesSchema.parse(args))
);

// Tool: get_node
server.tool(
  TOOL_DEFINITIONS.get_node.name,
  TOOL_DEFINITIONS.get_node.description,
  TOOL_DEFINITIONS.get_node.schema.shape,
  async (args) => await handleGetNode(dataStore, GetNodeSchema.parse(args))
);

// Tool: get_linked_nodes
server.tool(
  TOOL_DEFINITIONS.get_linked_nodes.name,
  TOOL_DEFINITIONS.get_linked_nodes.description,
  TOOL_DEFINITIONS.get_linked_nodes.schema.shape,
  async (args) => handleGetLinkedNodes(dataStore, GetLinkedNodesSchema.parse(args))
);

// Tool: get_schema
server.tool(
  TOOL_DEFINITIONS.get_schema.name,
  TOOL_DEFINITIONS.get_schema.description,
  TOOL_DEFINITIONS.get_schema.schema.shape,
  async () => handleGetSchema(dataStore)
);

// Tool: get_researcher_contributions
server.tool(
  TOOL_DEFINITIONS.get_researcher_contributions.name,
  TOOL_DEFINITIONS.get_researcher_contributions.description,
  TOOL_DEFINITIONS.get_researcher_contributions.schema.shape,
  async (args) =>
    handleGetResearcherContributions(
      dataStore,
      GetResearcherContributionsSchema.parse(args)
    )
);

// Tool: get_node_images
server.tool(
  TOOL_DEFINITIONS.get_node_images.name,
  TOOL_DEFINITIONS.get_node_images.description,
  TOOL_DEFINITIONS.get_node_images.schema.shape,
  async (args) => await handleGetNodeImages(dataStore, GetNodeImagesSchema.parse(args))
);

// Tool: get_relationships
server.tool(
  TOOL_DEFINITIONS.get_relationships.name,
  TOOL_DEFINITIONS.get_relationships.description,
  TOOL_DEFINITIONS.get_relationships.schema.shape,
  async (args) => handleGetRelationships(dataStore, GetRelationshipsSchema.parse(args))
);

// Tool: get_relation_types
server.tool(
  TOOL_DEFINITIONS.get_relation_types.name,
  TOOL_DEFINITIONS.get_relation_types.description,
  TOOL_DEFINITIONS.get_relation_types.schema.shape,
  async () => handleGetRelationTypes(dataStore)
);

// Tool: get_node_neighborhood
server.tool(
  TOOL_DEFINITIONS.get_node_neighborhood.name,
  TOOL_DEFINITIONS.get_node_neighborhood.description,
  TOOL_DEFINITIONS.get_node_neighborhood.schema.shape,
  async (args) => handleGetNodeNeighborhood(dataStore, GetNodeNeighborhoodSchema.parse(args))
);

// ============================================================================
// Server Startup
// ============================================================================

async function main() {
  // Load and index the discourse graph data
  console.error("Loading discourse graph data...");
  console.error(`Server name: ${SERVER_NAME}`);
  console.error(`Data path: ${DATA_PATH}`);

  // Validate data file exists
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`ERROR: Data file not found: ${DATA_PATH}`);
    console.error(`Please ensure DATA_PATH points to a valid JSON file.`);
    process.exit(1);
  }

  try {
    dataStore = loadData(DATA_PATH);
    console.error(`Loaded ${dataStore.allNodes.length} nodes`);
    console.error(`Loaded ${dataStore.allRelations.length} typed relationships`);
    console.error(`Loaded ${dataStore.relationDefs.size} relationship types`);
    console.error(`Researchers: ${dataStore.allCreators.join(", ")}`);
  } catch (error) {
    console.error("Failed to load data:", error);
    process.exit(1);
  }

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Discourse Graph MCP server '${SERVER_NAME}' running on stdio`);
}

// Start the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
