# Discourse Graph MCP Server

> **⚠️ Proof of Concept** - This is a prototype implementation for exploring how discourse graphs can be integrated with AI assistants through the Model Context Protocol (MCP). It is intended for prototyping and experimental purposes only.

## Overview

This MCP server exposes discourse graphs to AI assistants like Claude through the Model Context Protocol. It allows AI assistants to explore, search, and traverse structured knowledge graphs of research, supporting various node grammars and relationship types.

The server dynamically adapts to different discourse graph schemas, making it suitable for any domain or research area that uses the discourse graph format.

## What This Does

The server provides AI assistants with tools to:

- **Search** the knowledge graph using keywords and filters
- **Retrieve** detailed information about specific research nodes
- **Traverse** relationships between concepts, papers, and findings
- **Query** the ontology and relationship types
- **View** research images inline (automatically fetched and displayed)
- **Analyze** researcher contributions and statistics

All image content is served as native MCP image blocks (base64-encoded) for inline display in compatible MCP clients.

## Architecture

- **Protocol**: Model Context Protocol (MCP)
- **Runtime**: Node.js with TypeScript
- **Data Format**: JSON knowledge graph export
- **Image Handling**: Firebase URLs fetched and converted to base64 for inline display

## Tools Provided

1. `search_nodes` - Full-text search with type and property filters (supports any node type)
2. `get_node` - Get complete node details with key image
3. `get_linked_nodes` - Graph traversal with typed relationships
4. `get_schema` - Return dynamically loaded node type definitions from the dataset
5. `get_researcher_contributions` - Attribution and statistics
6. `get_node_images` - Get all images for a node (inline display)
7. `get_relationships` - Query typed relationships (Supports, Informs, Opposes, etc.)
8. `get_relation_types` - List all available relationship type definitions

**Key Feature:** The server dynamically loads node schemas from each dataset, supporting different node grammars including:
- Research-focused types (Result, Question, Claim, Evidence, Hypothesis, Conclusion, etc.)
- Project management types (Flow, Artifact, Project, Issue, Milestone, etc.)
- Theory and methodology types (Theory, Source, etc.)

## Installation

```bash
npm install
npm run build
```

## Usage

### Running the Server

```bash
npm start
```

### Configuration

#### Environment Variables

- `DATA_PATH`: Path to your discourse graph JSON file (required)
- `SERVER_NAME`: Custom server name (optional, auto-generated from filename if not provided)

#### Running a Single Server

```bash
# Using default data path (project root JSON file)
npm start

# Using custom data path
DATA_PATH=/path/to/your/graph.json npm start

# Using custom server name
SERVER_NAME=my-custom-server DATA_PATH=/path/to/graph.json npm start
```

#### Auto-Generated Server Names

If `SERVER_NAME` is not provided, the server automatically derives a name from the dataset filename:

| Filename | Auto-Generated Server Name |
|----------|----------------------------|
| `discourse-graphs_query-results_202512290038.json` | `discourse-graphs-server` |
| `akamatsulab_query-results_202512290139.json` | `akamatsulab-server` |
| `mydata.json` | `mydata-server` |

### Integrating with Claude Code

#### Single Server Setup

Add to your MCP settings configuration (typically `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "discourse-graph": {
      "command": "node",
      "args": ["/path/to/discourse-graph-mcp/dist/index.js"],
      "env": {
        "DATA_PATH": "/path/to/discourse-graphs_query-results.json"
      }
    }
  }
}
```

#### Multiple Server Setup (Different Datasets)

Run multiple discourse graph servers simultaneously with different datasets:

```json
{
  "mcpServers": {
    "discourse-graphs": {
      "command": "node",
      "args": ["/Users/makamats/Repos/MCP-DG-demo/dist/index.js"],
      "env": {
        "DATA_PATH": "/Users/makamats/Repos/MCP-DG-demo/discourse-graphs_query-results_202512290038.json"
      }
    },
    "akamatsulab": {
      "command": "node",
      "args": ["/Users/makamats/Repos/MCP-DG-demo/dist/index.js"],
      "env": {
        "DATA_PATH": "/Users/makamats/Repos/MCP-DG-demo/akamatsulab_query-results_202512290139.json"
      }
    }
  }
}
```

**Note:** The MCP client's configuration key (e.g., `"discourse-graphs"`, `"akamatsulab2"`) is independent of the internal server name. The server name is used in tool invocation and logging.

#### Custom Server Names

Override auto-generated names when needed:

```json
{
  "mcpServers": {
    "production-graph": {
      "command": "node",
      "args": ["/path/to/discourse-graph-mcp/dist/index.js"],
      "env": {
        "SERVER_NAME": "production-discourse-graph",
        "DATA_PATH": "/data/production/graph.json"
      }
    },
    "staging-graph": {
      "command": "node",
      "args": ["/path/to/discourse-graph-mcp/dist/index.js"],
      "env": {
        "SERVER_NAME": "staging-discourse-graph",
        "DATA_PATH": "/data/staging/graph.json"
      }
    }
  }
}
```

### Troubleshooting

#### Server Name Conflicts

If you see errors about duplicate server names, ensure each server instance has a unique name:

1. Use different `DATA_PATH` values (server names auto-generated from filename)
2. OR explicitly set unique `SERVER_NAME` values via environment variables

#### Data File Not Found

```
ERROR: Data file not found: /path/to/file.json
```

- Verify `DATA_PATH` points to an existing JSON file
- Use absolute paths to avoid ambiguity
- Check file permissions

#### Debugging Server Instances

Check server startup logs (stderr) to verify configuration:

```
Loading discourse graph data...
Server name: discourse-graphs-server
Data path: /Users/makamats/Repos/MCP-DG-demo/discourse-graphs_query-results_202512290038.json
Loaded 425 nodes
```

## Project Structure

```
src/
├── index.ts        # Main MCP server entry point
├── tools.ts        # Tool handlers and schemas
├── search.ts       # Keyword search implementation
├── dataLoader.ts   # JSON data loading and indexing
├── imageParser.ts  # Firebase image URL extraction
└── types.ts        # TypeScript types and schemas
```

## Development Status

This is a **proof-of-concept** implementation for exploring the integration of discourse graphs with AI assistants. It demonstrates:

- How structured knowledge graphs can be exposed through MCP
- Dynamic support for different node grammars and relationship types
- Inline image display capabilities for research content
- Graph traversal and typed relationship queries
- Full-text search over structured knowledge with attribution
- Multi-dataset support (run multiple servers for different graphs)

### Known Limitations

- Single static JSON data source (no live updates)
- Image fetching may be slow for large result sets
- Limited error handling and validation
- No authentication or access control
- Prototype-quality code not optimized for production

## License

MIT

## Contributing

This is an experimental prototype. Contributions, suggestions, and feedback are welcome as we explore how discourse graphs can enhance AI-assisted research workflows.
