# Claude Code Instructions: Discourse Graph MCP Server

## Project Overview

Build an MCP (Model Context Protocol) server to make discourse graph knowledge accessible to AI assistants like Claude. The primary data source is a JSON-LD file containing research nodes from the Akamatsu lab's discourse graph on cellular biophysics (endocytosis, membrane tension, actin dynamics).

## What is MCP?

MCP allows Claude to directly call API functions during conversation, guided by natural language descriptions. Unlike traditional APIs where developers write code and copy/paste results, MCP lets Claude invoke functions natively.

**Key difference from regular APIs**: Claude reads function descriptions and learns *when* to call each function. The descriptions matter enormously for usability.

---

## Phase 1: Data Ingestion & Schema

### Step 1.1: Parse the JSON-LD File

The data file is `akamatsulab_top100_similar_nodes.json`. It has this structure:

```json
{
  "@context": {
    "dg": "https://discoursegraphs.com/schema/v0#",
    "dc": "http://purl.org/dc/elements/1.1/",
    ...
  },
  "@graph": [
    {
      "@id": "pages:CnOU48Obk",
      "@type": "pages:lxCvhQ034",  // This is a node type UID, needs mapping
      "title": "[[RES]] - The antagonistic force/filament...",
      "content": "...",
      "modified": "2023-11-24T19:06:50.247Z",
      "created": "2023-11-24T18:55:29.733Z",
      "creator": "Abhishek Raghunathan"
    },
    ...
  ]
}
```

### Step 1.2: Extract Node Types from Titles

Node types are encoded in the title prefix using double brackets:
- `[[RES]]` → Result (experimental/simulation observation)
- `[[QUE]]` → Question (open research question)  
- `[[CON]]` → Conclusion (interpretation drawn from results)
- `[[EVD]]` → Evidence (supporting data from papers)
- `[[CLM]]` → Claim (assertion about biological mechanisms)
- `[[HYP]]` → Hypothesis (testable prediction)
- `[[ISS]]` → Issue (project task/analysis)

**Extract node type** with a regex like: `/^\[\[([A-Z]{3})\]\]/`

### Step 1.3: Extract Wikilinks from Content

The content contains wikilinks that represent untyped relationships:
- Internal links: `[[@cytosim/vary force-dependent capping...]]`
- Node links: `[[RES]] - Force-attenuated capping...`
- Page references: `https://roamresearch.com/#/app/akamatsulab/page/CnOU48Obk`

Extract these as `linkedNodes` for discovery purposes.

### Step 1.4: Build a Searchable Index

Create an in-memory index (or SQLite database) with:

```typescript
interface DiscourseNode {
  uid: string;              // e.g., "CnOU48Obk"
  nodeType: string;         // e.g., "RES", "QUE", "CON"
  title: string;            // Full title
  titleClean: string;       // Title without [[TYPE]] prefix
  content: string;          // Full markdown content
  summary?: string;         // Extracted summary section if present
  creator: string;          // e.g., "Abhishek Raghunathan"
  created: Date;
  modified: Date;
  linkedNodeUids: string[]; // UIDs of linked nodes (from wikilinks)
  url: string;              // Original Roam URL
}
```

---

## Phase 2: MCP Server Functions

### Function 1: `search_nodes` (Primary Discovery)

```json
{
  "name": "search_nodes",
  "description": "Search the Akamatsu lab discourse graph for research nodes about endocytosis, membrane tension, actin dynamics, and related cellular biophysics. Use this when looking for specific Results, Conclusions, Evidence, Questions, Hypotheses, or Claims from the lab's research. Always include the researcher name when citing results.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Keywords to search for (e.g., 'membrane tension force capping')"
      },
      "nodeType": {
        "type": "string",
        "enum": ["RES", "QUE", "CON", "EVD", "CLM", "HYP", "ISS"],
        "description": "Filter by node type. RES=Results, QUE=Questions, CON=Conclusions, EVD=Evidence, CLM=Claims, HYP=Hypotheses, ISS=Issues"
      },
      "creator": {
        "type": "string",
        "description": "Filter by researcher name (e.g., 'Matt Akamatsu', 'Abhishek Raghunathan')"
      },
      "limit": {
        "type": "number",
        "default": 10,
        "description": "Maximum number of results to return"
      }
    },
    "required": ["query"]
  }
}
```

**Implementation notes**:
- Full-text search across `title` and `content`
- Return title, nodeType, creator, created date, and a snippet
- Always include `creator` in results for attribution

### Function 2: `get_node` (Full Details)

```json
{
  "name": "get_node",
  "description": "Get complete details of a specific discourse node by its UID. Use this after finding a node via search to get full content, methodology context, and linked nodes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "uid": {
        "type": "string",
        "description": "The unique identifier of the node (e.g., 'CnOU48Obk')"
      }
    },
    "required": ["uid"]
  }
}
```

**Return format**:
```json
{
  "uid": "CnOU48Obk",
  "nodeType": "RES",
  "title": "The antagonistic force/filament experiencing force increased...",
  "creator": "Abhishek Raghunathan",
  "created": "2023-11-24T18:55:29.733Z",
  "content": "... full markdown ...",
  "linkedNodes": ["uid1", "uid2", ...],
  "url": "https://roamresearch.com/#/app/akamatsulab/page/CnOU48Obk"
}
```

### Function 3: `get_linked_nodes` (Graph Traversal)

```json
{
  "name": "get_linked_nodes",
  "description": "Get all nodes that are linked to/from a specific node. Use this to explore what Results support a Conclusion, what Questions a Result informs, or to trace reasoning chains through the discourse graph.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "uid": {
        "type": "string",
        "description": "The UID of the node to find connections for"
      },
      "direction": {
        "type": "string",
        "enum": ["outgoing", "incoming", "both"],
        "default": "both",
        "description": "outgoing = nodes this links TO, incoming = nodes that link TO this, both = all connections"
      }
    },
    "required": ["uid"]
  }
}
```

### Function 4: `get_schema` 

```json
{
  "name": "get_schema",
  "description": "Get the discourse graph ontology showing node types and their meanings. Use this to understand what types of nodes exist and how they relate.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

**Return**:
```json
{
  "nodeTypes": {
    "RES": {
      "label": "Result",
      "description": "Specific experimental or simulation observation with methodology context"
    },
    "QUE": {
      "label": "Question", 
      "description": "Open research question the lab is investigating"
    },
    "CON": {
      "label": "Conclusion",
      "description": "Interpretation or synthesis drawn from multiple results"
    },
    "EVD": {
      "label": "Evidence",
      "description": "Supporting data extracted from published papers"
    },
    "CLM": {
      "label": "Claim",
      "description": "Assertion about biological mechanisms"
    },
    "HYP": {
      "label": "Hypothesis",
      "description": "Testable prediction with rationale"
    },
    "ISS": {
      "label": "Issue",
      "description": "Project task or analysis to be done"
    }
  },
  "domain": "Cellular biophysics: endocytosis mechanics, membrane tension, actin architecture and dynamics, Cytosim simulations"
}
```

### Function 5: `get_researcher_contributions`

```json
{
  "name": "get_researcher_contributions",
  "description": "List all contributions by a specific researcher, or get statistics about all researchers in the graph. Use this for attribution and to understand who contributed what.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "creator": {
        "type": "string",
        "description": "Researcher name to filter by (optional - if omitted, returns summary for all researchers)"
      },
      "nodeType": {
        "type": "string",
        "enum": ["RES", "QUE", "CON", "EVD", "CLM", "HYP", "ISS"],
        "description": "Filter by node type"
      }
    }
  }
}
```

---

## Phase 3: MCP Server Implementation

### Technology Stack

Use the official MCP SDK:
```bash
npm install @modelcontextprotocol/sdk
```

### Basic Server Structure

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  {
    name: "discourse-graph-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Load and index the JSON-LD data on startup
let nodeIndex: Map<string, DiscourseNode>;

async function loadData() {
  const data = JSON.parse(fs.readFileSync("akamatsulab_top100_similar_nodes.json", "utf8"));
  nodeIndex = buildIndex(data["@graph"]);
}

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // ... tool definitions from Phase 2
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case "search_nodes":
      return searchNodes(args.query, args.nodeType, args.creator, args.limit);
    case "get_node":
      return getNode(args.uid);
    case "get_linked_nodes":
      return getLinkedNodes(args.uid, args.direction);
    case "get_schema":
      return getSchema();
    case "get_researcher_contributions":
      return getResearcherContributions(args.creator, args.nodeType);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  await loadData();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
```

---

## Phase 4: Testing

### Test Queries to Verify

1. **Basic search**: "membrane tension endocytosis"
2. **Type-filtered search**: "actin filaments" with nodeType="RES"
3. **Creator-filtered search**: all nodes by "Matt Akamatsu"
4. **Node retrieval**: get full details for a specific UID
5. **Link traversal**: find what nodes link to a specific Conclusion
6. **Attribution**: verify all responses include creator info

### MCP Inspector

Use the MCP inspector for interactive testing:
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Critical Design Principles

### 1. Attribution is Non-Negotiable
Every response must include `creator` and `created`. This is emphasized repeatedly in the project requirements.

### 2. Function Descriptions Are Documentation
Claude learns when to call functions from the descriptions. Write them as if explaining to a helpful colleague what each function does and when to use it.

### 3. Return Structured Data, Not Just Text
Return JSON with clear field names. Claude can synthesize this into natural language.

### 4. Support Iterative Discovery
Users don't know exact node UIDs. The workflow is:
1. Broad search → find candidates
2. Get full node details
3. Traverse links to related nodes
4. Synthesize across the graph

---

## File Structure

```
discourse-graph-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # Main server entry
│   ├── data/
│   │   ├── loader.ts     # JSON-LD parsing
│   │   └── index.ts      # Search index
│   ├── tools/
│   │   ├── search.ts
│   │   ├── getNode.ts
│   │   ├── getLinkedNodes.ts
│   │   ├── getSchema.ts
│   │   └── getResearcherContributions.ts
│   └── types.ts          # TypeScript interfaces
└── data/
    └── akamatsulab_top100_similar_nodes.json
```

---

## Environment & Configuration

### Claude Desktop Config (for testing)

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "discourse-graph": {
      "command": "node",
      "args": ["/path/to/discourse-graph-mcp/dist/index.js"],
      "env": {
        "DATA_PATH": "/path/to/akamatsulab_top100_similar_nodes.json"
      }
    }
  }
}
```

---

## Success Criteria

The MCP server enables Claude to:
- [ ] Search for nodes by keyword and filter by type/creator
- [ ] Retrieve full node content with all metadata
- [ ] Traverse wikilinks to discover related nodes
- [ ] Always attribute findings to the researcher who made them
- [ ] Answer questions like "What has the lab found about membrane tension effects on endocytosis?"
