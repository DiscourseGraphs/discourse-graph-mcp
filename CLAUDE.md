# Discourse Graph MCP Server

MCP server exposing the Akamatsu lab's discourse graph on cellular biophysics (endocytosis, membrane tension, actin dynamics).

## Project Structure

- `src/index.ts` - Main MCP server entry point, tool registration
- `src/tools.ts` - Tool handlers and schemas for all 8 tools
- `src/search.ts` - Keyword search implementation
- `src/dataLoader.ts` - JSON data loading and indexing
- `src/imageParser.ts` - Firebase image URL extraction
- `src/types.ts` - TypeScript types and node type schemas

## Tools

1. `search_nodes` - Full-text search with filters
2. `get_node` - Get complete node details (includes key image inline)
3. `get_linked_nodes` - Graph traversal with typed relationships
4. `get_schema` - Return ontology/node types
5. `get_researcher_contributions` - Attribution and statistics
6. `get_node_images` - Get all images for a node (inline display)
7. `get_relationships` - Query typed relationships
8. `get_relation_types` - List relationship type definitions

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
