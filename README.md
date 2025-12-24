# Discourse Graph MCP Server

> **⚠️ Proof of Concept** - This is a prototype implementation for exploring how discourse graphs can be integrated with AI assistants through the Model Context Protocol (MCP). It is intended for prototyping and experimental purposes only.

## Overview

This MCP server exposes the Akamatsu lab's discourse graph on cellular biophysics (endocytosis, membrane tension, actin dynamics) to AI assistants like Claude. By implementing the Model Context Protocol, it allows AI assistants to explore, search, and traverse a structured knowledge graph of scientific research.

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

1. `search_nodes` - Full-text search with type and property filters
2. `get_node` - Get complete node details with key image
3. `get_linked_nodes` - Graph traversal with typed relationships
4. `get_schema` - Return ontology/node type definitions
5. `get_researcher_contributions` - Attribution and statistics
6. `get_node_images` - Get all images for a node (inline display)
7. `get_relationships` - Query typed relationships
8. `get_relation_types` - List relationship type definitions

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

Set the `DATA_PATH` environment variable to specify the location of your discourse graph JSON file:

```bash
DATA_PATH=/path/to/your/graph.json npm start
```

### Integrating with Claude Code

Add to your MCP settings configuration:

```json
{
  "mcpServers": {
    "discourse-graph": {
      "command": "node",
      "args": ["/path/to/discourse-graph-mcp/dist/index.js"],
      "env": {
        "DATA_PATH": "/path/to/your/graph.json"
      }
    }
  }
}
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
- Inline image display capabilities for research content
- Graph traversal and relationship queries
- Full-text search over scientific knowledge

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
