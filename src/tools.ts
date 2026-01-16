/**
 * MCP Tool Definitions and Handlers
 *
 * Defines the 8 tools exposed by the discourse graph MCP server:
 * 1. search_nodes - Full-text search with filters
 * 2. get_node - Get complete node details by UID
 * 3. get_linked_nodes - Graph traversal with typed relationships
 * 4. get_schema - Return ontology/node types
 * 5. get_researcher_contributions - List contributions by researcher
 * 6. get_node_images - Get image URLs for a node
 * 7. get_relationships - Query typed relationships (Supports, Informs, Opposes)
 * 8. get_relation_types - List available relationship type definitions
 */

import { z } from "zod";
import { DataStore } from "./dataLoader.js";
import { searchNodes } from "./search.js";
import { NodeType, COMMON_NODE_TYPE_DESCRIPTIONS } from "./types.js";

/**
 * Fetch an image from URL and convert to base64
 * Returns null if fetch fails
 */
async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return { data: base64, mimeType: contentType };
  } catch {
    return null;
  }
}

// ============================================================================
// Tool Input Schemas (using Zod)
// ============================================================================

export const SearchNodesSchema = z.object({
  query: z
    .string()
    .describe("Keywords to search for (e.g., 'membrane tension force capping')"),
  nodeType: z
    .string()
    .optional()
    .describe(
      "Filter by node type (e.g., 'RES', 'QUE', 'CON', 'EVD', 'CLM', 'HYP', 'ISS', 'Flow', 'Artifact', etc.). Use get_schema to see available node types."
    ),
  creator: z
    .string()
    .optional()
    .describe("Filter by researcher name (e.g., 'Matt Akamatsu')"),
  orderBy: z
    .enum(["created", "modified", "title"])
    .optional()
    .describe("Sort results by field (created = creation date, modified = last modified date, title = alphabetical)"),
  sortDirection: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc")
    .describe("Sort direction (asc = ascending/oldest first, desc = descending/newest first). Default is 'desc'"),
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum number of results to return (default 10)")
});

export const GetNodeSchema = z.object({
  uid: z
    .string()
    .describe("The unique identifier of the node (e.g., 'CnOU48Obk')")
});

export const GetLinkedNodesSchema = z.object({
  uid: z.string().describe("The UID of the node to find connections for"),
  direction: z
    .enum(["outgoing", "incoming", "both"])
    .optional()
    .default("both")
    .describe(
      "outgoing = nodes this links TO, incoming = nodes that link TO this, both = all connections"
    )
});

export const GetSchemaSchema = z.object({});

export const GetResearcherContributionsSchema = z.object({
  creator: z
    .string()
    .optional()
    .describe(
      "Researcher name to filter by (optional - if omitted, returns summary for all researchers)"
    ),
  nodeType: z
    .string()
    .optional()
    .describe("Filter by node type (use get_schema to see available types)")
});

export const GetNodeImagesSchema = z.object({
  uid: z
    .string()
    .describe("The unique identifier of the node to get images for")
});

export const GetRelationshipsSchema = z.object({
  sourceUid: z
    .string()
    .optional()
    .describe("Filter by source node UID (e.g., get all relationships FROM this node)"),
  destinationUid: z
    .string()
    .optional()
    .describe("Filter by destination node UID (e.g., get all relationships TO this node)"),
  relationshipType: z
    .string()
    .optional()
    .describe("Filter by relationship type label (e.g., 'Supports', 'Informs', 'Opposes')")
});

export const GetRelationTypesSchema = z.object({});

export const GetNodeNeighborhoodSchema = z.object({
  uid: z
    .string()
    .describe("The UID of the starting node"),
  depth: z
    .number()
    .min(1)
    .max(4)
    .default(2)
    .describe("Number of hops to traverse from the starting node (1-4, default 2). Higher values may return many nodes."),
  direction: z
    .enum(["outgoing", "incoming", "both"])
    .optional()
    .default("both")
    .describe("Direction to traverse: outgoing = follow links FROM this node, incoming = find nodes linking TO this node, both = bidirectional"),
  nodeTypeFilter: z
    .string()
    .optional()
    .describe("Only include nodes of this type in results (e.g., 'RES', 'CLM', 'EVD')"),
  relationshipTypeFilter: z
    .string()
    .optional()
    .describe("Only follow relationships of this type (e.g., 'Supports', 'Informs'). If omitted, follows all relationships.")
});

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Handle search_nodes tool
 */
export function handleSearchNodes(
  dataStore: DataStore,
  args: z.infer<typeof SearchNodesSchema>
) {
  const results = searchNodes(
    dataStore,
    args.query,
    args.nodeType as NodeType | undefined,
    args.creator,
    args.orderBy,
    args.sortDirection,
    args.limit
  );

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ results, count: results.length }, null, 2)
      }
    ]
  };
}

/**
 * Handle get_node tool
 * Returns node details with key image as native MCP image content block
 */
export async function handleGetNode(
  dataStore: DataStore,
  args: z.infer<typeof GetNodeSchema>
) {
  const node = dataStore.nodesByUid.get(args.uid);

  if (!node) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: `Node not found: ${args.uid}` }, null, 2)
        }
      ],
      isError: true
    };
  }

  // Build content array
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  > = [];

  // Identify the key image (first image in the node)
  const keyImage = node.imageUrls.length > 0 ? node.imageUrls[0] : null;

  // Add text metadata
  content.push({
    type: "text" as const,
    text: JSON.stringify(
      {
        uid: node.uid,
        nodeType: node.nodeType,
        title: node.titleClean,
        creator: node.creator,
        created: node.created,
        modified: node.modified,
        content: node.content,
        linkedNodes: node.linkedNodeUids,
        imageUrls: node.imageUrls,
        imageCount: node.imageUrls.length,
        url: node.url
      },
      null,
      2
    )
  });

  // Fetch and add key image as native image content block
  if (keyImage) {
    const imageData = await fetchImageAsBase64(keyImage);
    if (imageData) {
      content.push({
        type: "image" as const,
        data: imageData.data,
        mimeType: imageData.mimeType
      });
    }
  }

  return { content };
}

/**
 * Handle get_linked_nodes tool
 * Returns both text references and typed relationships
 */
export function handleGetLinkedNodes(
  dataStore: DataStore,
  args: z.infer<typeof GetLinkedNodesSchema>
) {
  const sourceNode = dataStore.nodesByUid.get(args.uid);

  if (!sourceNode) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: `Node not found: ${args.uid}` }, null, 2)
        }
      ],
      isError: true
    };
  }

  const linkedNodes: Array<{
    uid: string;
    nodeType: NodeType | null;
    title: string;
    creator: string;
    direction: string;
    relationshipType?: string;  // e.g., "Supports", "Informs", "Opposes"
  }> = [];

  // Track which nodes we've already added (to avoid duplicates)
  const addedNodes = new Set<string>();

  // Outgoing typed relationships (e.g., this Evidence "Supports" a Claim)
  if (args.direction === "outgoing" || args.direction === "both") {
    const outgoingRelations = dataStore.relationsBySource.get(args.uid) || [];
    for (const relation of outgoingRelations) {
      const destNode = dataStore.nodesByUid.get(relation.destinationUid);
      if (destNode && !addedNodes.has(`out-${destNode.uid}`)) {
        linkedNodes.push({
          uid: destNode.uid,
          nodeType: destNode.nodeType,
          title: destNode.titleClean,
          creator: destNode.creator,
          direction: "outgoing",
          relationshipType: relation.label
        });
        addedNodes.add(`out-${destNode.uid}`);
      }
    }

    // Also include text references (nodes mentioned in content)
    for (const linkedUid of sourceNode.linkedNodeUids) {
      const linkedNode = dataStore.nodesByUid.get(linkedUid);
      if (linkedNode && !addedNodes.has(`out-${linkedNode.uid}`)) {
        linkedNodes.push({
          uid: linkedNode.uid,
          nodeType: linkedNode.nodeType,
          title: linkedNode.titleClean,
          creator: linkedNode.creator,
          direction: "outgoing"
          // No relationshipType - this is a text reference, not a typed relation
        });
        addedNodes.add(`out-${linkedNode.uid}`);
      }
    }
  }

  // Incoming typed relationships (e.g., a Claim is "Supported By" this Evidence)
  if (args.direction === "incoming" || args.direction === "both") {
    const incomingRelations = dataStore.relationsByDestination.get(args.uid) || [];
    for (const relation of incomingRelations) {
      const srcNode = dataStore.nodesByUid.get(relation.sourceUid);
      if (srcNode && !addedNodes.has(`in-${srcNode.uid}`)) {
        linkedNodes.push({
          uid: srcNode.uid,
          nodeType: srcNode.nodeType,
          title: srcNode.titleClean,
          creator: srcNode.creator,
          direction: "incoming",
          relationshipType: relation.label
        });
        addedNodes.add(`in-${srcNode.uid}`);
      }
    }

    // Also include text references (nodes that mention this node)
    for (const node of dataStore.allNodes) {
      if (node.uid !== args.uid && node.linkedNodeUids.includes(args.uid)) {
        if (!addedNodes.has(`in-${node.uid}`)) {
          linkedNodes.push({
            uid: node.uid,
            nodeType: node.nodeType,
            title: node.titleClean,
            creator: node.creator,
            direction: "incoming"
          });
          addedNodes.add(`in-${node.uid}`);
        }
      }
    }
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            sourceUid: args.uid,
            sourceTitle: sourceNode.titleClean,
            linkedNodes,
            count: linkedNodes.length,
            typedRelationCount: linkedNodes.filter(n => n.relationshipType).length
          },
          null,
          2
        )
      }
    ]
  };
}

/**
 * Handle get_schema tool
 * Returns the node types and schemas dynamically loaded from the dataset
 */
export function handleGetSchema(dataStore: DataStore) {
  // Build node type schemas from loaded data
  const nodeTypes: Record<string, { label: string; description: string; uid: string }> = {};

  for (const [uid, schema] of dataStore.nodeSchemas.entries()) {
    const label = schema.label;
    const nodeType = schema.nodeType || label;

    // Use common description if available, otherwise create a generic one
    const description = COMMON_NODE_TYPE_DESCRIPTIONS[nodeType]?.description ||
                       `${label} node in the discourse graph`;

    nodeTypes[nodeType] = {
      label,
      description,
      uid
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            nodeTypes,
            totalSchemas: dataStore.nodeSchemas.size,
            dataSource: "Roam Research discourse graph"
          },
          null,
          2
        )
      }
    ]
  };
}

/**
 * Handle get_researcher_contributions tool
 */
export function handleGetResearcherContributions(
  dataStore: DataStore,
  args: z.infer<typeof GetResearcherContributionsSchema>
) {
  if (args.creator) {
    // Get contributions for specific researcher
    let nodes = dataStore.nodesByCreator.get(args.creator) || [];

    // Try case-insensitive match if exact match fails
    if (nodes.length === 0) {
      for (const [name, creatorNodes] of dataStore.nodesByCreator.entries()) {
        if (name.toLowerCase().includes(args.creator.toLowerCase())) {
          nodes = creatorNodes;
          break;
        }
      }
    }

    // Filter by nodeType if specified
    if (args.nodeType) {
      nodes = nodes.filter(n => n.nodeType === args.nodeType);
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              creator: args.creator,
              contributions: nodes.map(n => ({
                uid: n.uid,
                nodeType: n.nodeType,
                title: n.titleClean,
                created: n.created,
                imageCount: n.imageUrls.length
              })),
              count: nodes.length
            },
            null,
            2
          )
        }
      ]
    };
  } else {
    // Return summary for all researchers
    const summary: Array<{
      creator: string;
      totalNodes: number;
      byType: Record<string, number>;
    }> = [];

    for (const [creator, nodes] of dataStore.nodesByCreator.entries()) {
      const byType: Record<string, number> = {};
      for (const node of nodes) {
        const type = node.nodeType || "UNKNOWN";
        byType[type] = (byType[type] || 0) + 1;
      }
      summary.push({ creator, totalNodes: nodes.length, byType });
    }

    // Sort by total contributions descending
    summary.sort((a, b) => b.totalNodes - a.totalNodes);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ researchers: summary }, null, 2)
        }
      ]
    };
  }
}

/**
 * Handle get_node_images tool
 * Returns images as native MCP image content blocks for inline display
 */
export async function handleGetNodeImages(
  dataStore: DataStore,
  args: z.infer<typeof GetNodeImagesSchema>
) {
  const node = dataStore.nodesByUid.get(args.uid);

  if (!node) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: `Node not found: ${args.uid}` }, null, 2)
        }
      ],
      isError: true
    };
  }

  // Build content array with text metadata first
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  > = [];

  // Add text metadata
  content.push({
    type: "text" as const,
    text: JSON.stringify(
      {
        uid: node.uid,
        title: node.titleClean,
        creator: node.creator,
        imageCount: node.imageUrls.length,
        imageUrls: node.imageUrls
      },
      null,
      2
    )
  });

  // Fetch and add images as native image content blocks
  for (const imageUrl of node.imageUrls) {
    const imageData = await fetchImageAsBase64(imageUrl);
    if (imageData) {
      content.push({
        type: "image" as const,
        data: imageData.data,
        mimeType: imageData.mimeType
      });
    }
  }

  return { content };
}

/**
 * Handle get_relationships tool
 * Query typed relationships with optional filters
 */
export function handleGetRelationships(
  dataStore: DataStore,
  args: z.infer<typeof GetRelationshipsSchema>
) {
  let relationships = dataStore.allRelations;

  // Filter by source UID
  if (args.sourceUid) {
    relationships = relationships.filter(r => r.sourceUid === args.sourceUid);
  }

  // Filter by destination UID
  if (args.destinationUid) {
    relationships = relationships.filter(r => r.destinationUid === args.destinationUid);
  }

  // Filter by relationship type (case-insensitive)
  if (args.relationshipType) {
    const typeFilter = args.relationshipType.toLowerCase();
    relationships = relationships.filter(r => r.label.toLowerCase() === typeFilter);
  }

  // Enrich with node details
  const enrichedRelationships = relationships.map(r => {
    const sourceNode = dataStore.nodesByUid.get(r.sourceUid);
    const destNode = dataStore.nodesByUid.get(r.destinationUid);
    return {
      source: sourceNode
        ? { uid: sourceNode.uid, title: sourceNode.titleClean, nodeType: sourceNode.nodeType }
        : { uid: r.sourceUid, title: "Unknown", nodeType: null },
      destination: destNode
        ? { uid: destNode.uid, title: destNode.titleClean, nodeType: destNode.nodeType }
        : { uid: r.destinationUid, title: "Unknown", nodeType: null },
      relationshipType: r.label,
      predicateUid: r.predicateUid
    };
  });

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            relationships: enrichedRelationships,
            count: enrichedRelationships.length
          },
          null,
          2
        )
      }
    ]
  };
}

/**
 * Handle get_relation_types tool
 * List all available relationship type definitions
 */
export function handleGetRelationTypes(dataStore: DataStore) {
  const relationTypes = Array.from(dataStore.relationDefs.values()).map(rd => ({
    uid: rd.uid,
    label: rd.label,
    domain: rd.domainLabel,
    range: rd.rangeLabel,
    description: `${rd.domainLabel} ${rd.label} ${rd.rangeLabel}`
  }));

  // Count how many instances of each type exist
  const typeCounts = new Map<string, number>();
  for (const rel of dataStore.allRelations) {
    const count = typeCounts.get(rel.label) || 0;
    typeCounts.set(rel.label, count + 1);
  }

  const relationTypesWithCounts = relationTypes.map(rt => ({
    ...rt,
    instanceCount: typeCounts.get(rt.label) || 0
  }));

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            relationTypes: relationTypesWithCounts,
            count: relationTypesWithCounts.length,
            totalRelationships: dataStore.allRelations.length
          },
          null,
          2
        )
      }
    ]
  };
}

/**
 * Handle get_node_neighborhood tool
 * Get K-hop neighborhood around a node using breadth-first search
 */
export function handleGetNodeNeighborhood(
  dataStore: DataStore,
  args: z.infer<typeof GetNodeNeighborhoodSchema>
) {
  const startNode = dataStore.nodesByUid.get(args.uid);

  if (!startNode) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: `Node not found: ${args.uid}` }, null, 2)
        }
      ],
      isError: true
    };
  }

  // Track visited nodes with their hop distance
  const visited = new Map<string, number>();
  visited.set(args.uid, 0);

  // BFS queue: [nodeUid, currentDepth]
  const queue: Array<[string, number]> = [[args.uid, 0]];

  // Results organized by hop distance
  const nodesByHop: Array<Array<{
    uid: string;
    nodeType: NodeType | null;
    title: string;
    creator: string;
    relationshipType?: string;
  }>> = Array.from({ length: args.depth + 1 }, () => []);

  // Add starting node to hop 0
  nodesByHop[0].push({
    uid: startNode.uid,
    nodeType: startNode.nodeType,
    title: startNode.titleClean,
    creator: startNode.creator
  });

  // BFS traversal
  while (queue.length > 0) {
    const [currentUid, currentDepth] = queue.shift()!;

    // Stop if we've reached max depth
    if (currentDepth >= args.depth) {
      continue;
    }

    const currentNode = dataStore.nodesByUid.get(currentUid);
    if (!currentNode) continue;

    const neighbors = new Map<string, { nodeUid: string; relationshipType?: string }>();

    // Collect outgoing neighbors
    if (args.direction === "outgoing" || args.direction === "both") {
      // Typed relationships
      const outgoingRelations = dataStore.relationsBySource.get(currentUid) || [];
      for (const relation of outgoingRelations) {
        // Filter by relationship type if specified
        if (args.relationshipTypeFilter && relation.label !== args.relationshipTypeFilter) {
          continue;
        }
        neighbors.set(relation.destinationUid, {
          nodeUid: relation.destinationUid,
          relationshipType: relation.label
        });
      }

      // Text references
      if (!args.relationshipTypeFilter) {  // Text refs don't have relationship types
        for (const linkedUid of currentNode.linkedNodeUids) {
          if (!neighbors.has(linkedUid)) {
            neighbors.set(linkedUid, { nodeUid: linkedUid });
          }
        }
      }
    }

    // Collect incoming neighbors
    if (args.direction === "incoming" || args.direction === "both") {
      // Typed relationships
      const incomingRelations = dataStore.relationsByDestination.get(currentUid) || [];
      for (const relation of incomingRelations) {
        // Filter by relationship type if specified
        if (args.relationshipTypeFilter && relation.label !== args.relationshipTypeFilter) {
          continue;
        }
        neighbors.set(relation.sourceUid, {
          nodeUid: relation.sourceUid,
          relationshipType: relation.label
        });
      }

      // Text references (nodes that mention this node)
      if (!args.relationshipTypeFilter) {
        for (const node of dataStore.allNodes) {
          if (node.uid !== currentUid && node.linkedNodeUids.includes(currentUid)) {
            if (!neighbors.has(node.uid)) {
              neighbors.set(node.uid, { nodeUid: node.uid });
            }
          }
        }
      }
    }

    // Process neighbors
    for (const { nodeUid, relationshipType } of neighbors.values()) {
      // Skip if already visited
      if (visited.has(nodeUid)) {
        continue;
      }

      const neighborNode = dataStore.nodesByUid.get(nodeUid);
      if (!neighborNode) continue;

      // Apply node type filter if specified
      if (args.nodeTypeFilter && neighborNode.nodeType !== args.nodeTypeFilter) {
        continue;
      }

      // Mark as visited and add to queue
      const nextDepth = currentDepth + 1;
      visited.set(nodeUid, nextDepth);
      queue.push([nodeUid, nextDepth]);

      // Add to results
      nodesByHop[nextDepth].push({
        uid: neighborNode.uid,
        nodeType: neighborNode.nodeType,
        title: neighborNode.titleClean,
        creator: neighborNode.creator,
        relationshipType
      });
    }
  }

  // Build summary statistics
  const hopCounts = nodesByHop.map((nodes, hop) => ({
    hop,
    count: nodes.length
  }));

  const totalNodes = nodesByHop.reduce((sum, nodes) => sum + nodes.length, 0);

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            startUid: args.uid,
            startTitle: startNode.titleClean,
            depth: args.depth,
            direction: args.direction,
            totalNodes,
            hopCounts,
            nodesByHop
          },
          null,
          2
        )
      }
    ]
  };
}

// ============================================================================
// Tool Definitions for MCP Server
// ============================================================================

export const TOOL_DEFINITIONS = {
  search_nodes: {
    name: "search_nodes",
    description:
      "Search the discourse graph for research nodes by keywords. Use this when looking for specific research contributions, questions, evidence, claims, or other node types. Always include the researcher name when citing results. Use get_schema to see what node types are available in this graph.",
    schema: SearchNodesSchema
  },
  get_node: {
    name: "get_node",
    description:
      "Get complete details of a specific discourse node by its UID. Use this after finding a node via search to get full content, methodology context, linked nodes, and image URLs. IMPORTANT: When a node has images, display the keyImage (first/primary image) in your response using markdown syntax ![description](url) and provide a brief description/legend explaining what the figure shows.",
    schema: GetNodeSchema
  },
  get_linked_nodes: {
    name: "get_linked_nodes",
    description:
      "Get all nodes that are linked to/from a specific node. Use this to explore connections between nodes and trace reasoning chains through the discourse graph. Shows how different research contributions relate to each other.",
    schema: GetLinkedNodesSchema
  },
  get_schema: {
    name: "get_schema",
    description:
      "Get the discourse graph ontology showing node types and their meanings. Use this to understand what types of nodes exist in this particular discourse graph and what they represent. Different graphs may have different node grammars.",
    schema: GetSchemaSchema
  },
  get_researcher_contributions: {
    name: "get_researcher_contributions",
    description:
      "List all contributions by a specific researcher, or get statistics about all researchers in the graph. Use this for attribution and to understand who contributed what to the discourse graph.",
    schema: GetResearcherContributionsSchema
  },
  get_node_images: {
    name: "get_node_images",
    description:
      "Get all figure/diagram images from a discourse node. Returns publicly accessible Firebase URLs that can be viewed directly. Use this when the user wants to see or understand the visual data (plots, diagrams, screenshots) associated with a research result or conclusion. IMPORTANT: Always display the keyImage (first/primary image) in your response using markdown syntax ![description](url) and provide a brief description/legend explaining what the figure shows. Claude can interpret these images using vision capabilities.",
    schema: GetNodeImagesSchema
  },
  get_relationships: {
    name: "get_relationships",
    description:
      "Query typed relationships between nodes (e.g., Evidence 'Supports' Claim, Result 'Informs' Question). Use this to explore how nodes are semantically connected with labeled relationship types. Can filter by source node, destination node, or relationship type.",
    schema: GetRelationshipsSchema
  },
  get_relation_types: {
    name: "get_relation_types",
    description:
      "List all available relationship type definitions in the discourse graph (e.g., Supports, Informs, Opposes). Shows what types of semantic connections exist between nodes and how many instances of each type are present.",
    schema: GetRelationTypesSchema
  },
  get_node_neighborhood: {
    name: "get_node_neighborhood",
    description:
      "Get the K-hop neighborhood around a node. Performs breadth-first traversal to find all nodes within N hops (1-4) of the starting node. Results are organized by hop distance. Use this to explore the local context around a research contribution or to find multi-hop reasoning chains. Supports filtering by node type and relationship type, and can traverse in any direction.",
    schema: GetNodeNeighborhoodSchema
  }
};
