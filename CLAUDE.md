# Discourse Graph MCP Server

MCP server for exposing discourse graphs to AI assistants. Supports any discourse graph with dynamic node schemas and relationship types.

## Project Structure

- `src/index.ts` - Main MCP server entry point, tool registration
- `src/tools.ts` - Tool handlers and schemas for all 9 tools
- `src/search.ts` - Keyword search implementation with sorting
- `src/dataLoader.ts` - JSON data loading and indexing
- `src/imageParser.ts` - Firebase image URL extraction
- `src/types.ts` - TypeScript types and node type schemas

## Tools

1. `search_nodes` - Full-text search with filters and sorting (by created/modified/title)
2. `get_node` - Get complete node details (includes key image inline)
3. `get_linked_nodes` - Graph traversal with typed relationships
4. `get_schema` - Return ontology/node types
5. `get_researcher_contributions` - Attribution and statistics
6. `get_node_images` - Get all images for a node (inline display)
7. `get_relationships` - Query typed relationships
8. `get_relation_types` - List relationship type definitions
9. `get_node_neighborhood` - K-hop neighborhood traversal (BFS, 1-4 hops)

## Image Display

Images are returned as **native MCP image content blocks** (base64-encoded) rather than URLs. This allows MCP clients (Claude Code, etc.) to render images directly inline in chat responses.

Key implementation in `tools.ts`:
- `fetchImageAsBase64()` - Fetches image URL and converts to base64
- `handleGetNode()` - Returns key image (first image) as inline content
- `handleGetNodeImages()` - Returns all images as inline content blocks

## Build & Run

```bash
npm run build    # Compile TypeScript
npm start        # Run MCP server
```

## Data

Data file path can be set via `DATA_PATH` environment variable, defaults to JSON file in project root.

Server name can be set via `SERVER_NAME` environment variable. If not provided, the server automatically derives the name from the dataset filename prefix (e.g., `discourse-graphs_query-results_*.json` → `discourse-graphs-server`).

## Configuration Examples

### Single Server

```bash
DATA_PATH=/path/to/dataset.json npm start
```

### Multiple Servers

Different MCP client configurations can launch multiple server instances with different datasets:

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

Server names will be auto-generated as:
- `discourse-graphs-server`
- `akamatsulab-server`
