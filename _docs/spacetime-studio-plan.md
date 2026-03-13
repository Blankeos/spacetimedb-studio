# SpacetimeDB Studio - Implementation Plan

## Overview

Create a CLI tool similar to `drizzle-kit studio` that provides a local web-based database studio for SpacetimeDB databases, featuring a vim-enabled SQL editor and table viewer.

## Goals

1. Run CLI: `spacetime-studio [db]` or `spacetime-studio --db <database-name>`
2. Studio runs on `localhost:5555` (or configured port)
3. Interactive features:
   - Priority 1 (HIGH): SQL editor with vim mode (CodeMirror + vim keybindings)
   - Priority 2 (LOW): Table viewer using data-table component
   - Nice-to-have: Schema diagram visualization

## Architecture

```
spacetimedb-studio/
├── packages/
│   └── cli/                    # CLI entry point
│       └── src/
│           └── cli.ts          # Parses args, starts server
├── apps/
│   ├── studio/                 # NEW: Studio frontend (SolidJS + Vike)
│   │   └── src/
│   │       ├── pages/          # Routes
│   │       │   ├── +Layout.tsx
│   │       │   ├── index/+Page.tsx      # SQL Editor
│   │       │   └── tables/+Page.tsx     # Table viewer (low priority)
│   │       ├── components/
│   │       │   ├── sql-editor/          # CodeMirror + vim setup
│   │       │   └── ui/                   # Shadcn components
│   │       └── server/
│   │           └── server.ts            # Hono server with endpoints
│   └── runtime/                # Existing: SolidJS + Vike template
```

## Implementation Phases

### Phase 1: Core Infrastructure (CLI + Server)

**Files to create/modify:**

1. `packages/cli/package.json` - Update with dependencies
2. `packages/cli/src/cli.ts` - Main CLI entry point
3. `apps/studio/` - Create new app (copy from runtime as base)

**CLI Responsibilities:**

- Parse database name argument
- Start Hono server on configured port
- Serve static frontend assets
- Provide API endpoints for SpacetimeDB interaction

**Key Dependencies:**

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@hono/node-server": "^1.x",
    "commander": "^12.x",
    "chalk": "^5.x"
  }
}
```

### Phase 2: SQL Execution Backend

**API Endpoints:**

```
POST /api/sql
  Body: { sql: string, database: string }
  Returns: { results: any[], error?: string }

GET /api/describe?db=<database>
  Returns: Schema from `spacetime describe [db] --json`
```

**Implementation:**

- Use `Bun.spawn()` to execute `spacetime sql [db] "<query>"`
- Parse `spacetime describe [db] --json` output for schema info
- Handle streaming results for long-running queries

### Phase 3: SQL Editor Frontend (Priority 1)

**Components:**

1. `apps/studio/src/components/sql-editor/SqlEditor.tsx`
   - CodeMirror with SQL mode
   - Vim keybindings via `@codemirror/vim`
   - Query history
   - Result display panel

**Dependencies:**

```json
{
  "dependencies": {
    "@codemirror/lang-sql": "^6.x",
    "@codemirror/theme-one-dark": "^6.x",
    "codemirror": "^6.x",
    "@replit/codemirror-vim": "^6.x"
  }
}
```

**Features:**

- Vim mode toggle
- SQL autocompletion (tables/columns from describe)
- Query execution with keyboard shortcut (leader-enter or :w)
- Result grid display
- Error highlighting

### Phase 4: Table Viewer (Priority 2 - Low)

**Later implementation:**

- Use `@tanstack/solid-table` with shadcn data-table patterns
- Parse `spacetime describe [db] --json` output
- Display table columns with types
- Basic pagination for row preview

### Phase 5: Schema Diagram (Nice-to-have)

**Implementation:**

- Parse describe JSON for tables and relationships
- Use a graph visualization library (e.g., D3.js or vis-network)
- Show table nodes with field labels
- Draw relationship edges

## Test Case

```json
{
  "typespace": {
    "types": [
      { "Product": { "elements": [{ "name": { "some": "name" }, "algebraic_type": { "String": [] } }] } }
    ]
  },
  "tables": [
    {
      "name": "person",
      "product_type_ref": 0,
      "primary_key": [],
      "indexes": [],
      "constraints": [],
      "sequences": [],
      "schedule": { "none": [] },
      "table_type": { "User": [] },
      "table_access": { "Public": [] }
    }
  ],
  "reducers": [
    { "name": "add", "params": { "elements": [{ "name": { "some": "name" }, "algebraic_type": { "String": [] } }] }, "lifecycle": { "none": [] } },
    { "name": "init", "params": { "elements": [] }, "lifecycle": { "some": { "Init": [] } } },
    { "name": "on_connect", "params": { "elements": [] }, "lifecycle": { "some": { "OnConnect": [] } } },
    { "name": "on_disconnect", "params": { "elements": [] }, "lifecycle": { "some": { "OnDisconnect": [] } } },
    { "name": "say_hello", "params": { "elements": [] }, "lifecycle": { "none": [] } }
    }
  ],
  "types": [
    { "name": { "scope": [], "name": "Add" }, "ty": 1, "custom_ordering": true },
    { "name": { "scope": [], "name": "Init" }, "ty": 2, "custom_ordering": true },
    { "name": { "scope": [], "name": "OnConnect" }, "ty": 3, "custom_ordering": true },
    { "name": { "scope": [], "name": "OnDisconnect" }, "ty": 4, "custom_ordering": true },
    { "name": { "scope": [], "name": "Person" }, "ty": 0, "custom_ordering": true },
    { "name": { "scope": [], "name": "SayHello" }, "ty": 5, "custom_ordering": true }
  ],
  "misc_exports": [],
  "row_level_security": []
}
```

## CLI Usage

```bash
# Basic usage
spacetime-studio my-database

# With options
spacetime-studio --db my-database --port 5555 --host localhost

# Help
spacetime-studio --help
```

## API Endpoints

### POST /api/sql

Execute SQL query on SpacetimeDB database.

**Request:**

```json
{
  "sql": "SELECT * FROM person",
  "database": "my-database"
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    { "name": "Alice", "id": 1 },
    { "name": "Bob", "id": 2 }
  ],
  "error": null
}
```

### GET /api/describe

Get schema information for database.

**Query params:** `?db=<database-name>`

**Response:** Full describe JSON output from `spacetime describe --json`

## Technical Decisions

### 1. Frontend Framework

- **Choice:** SolidJS + Vike (same as runtime app)
- **Reason:** Consistent with existing codebase, good DX, SSR support

### 2. Server Framework

- **Choice:** Hono
- **Reason:** Lightweight, already used in existing codebase, works with Bun

### 3. SQL Editor

- **Choice:** CodeMirror 6 with vim extension
- **Reason:** Industry standard, excellent vim support, extensible

### 4. Table Viewer

- **Choice:** TanStack Table (Solid adapter)
- **Reason:** Headless, performant, shadcn integration available

## UI/UX Design Requirements

### Reference Projects

1. **`_tmp_solid-launch/`** - Use for SolidJS patterns, component structure, styling conventions
2. **Drizzle Studio** - Imitate the visual design and user experience

### Required Stack (Non-Negotiable)

- **Tailwind CSS** - Styling framework
- **Shadcn Components** - UI component library (solid-ui variants)
- **TanStack Table** - Data tables (`@tanstack/solid-table`)
- **TanStack Query** - Data fetching (`@tanstack/solid-query`)

### Design Imitation Goals

The UI should feel similar to Drizzle Studio:

- Dark theme by default (one-dark variant)
- Clean, minimal interface
- Split-pane layout: SQL editor on left/top, results on right/bottom
- Monospace fonts for SQL and data
- Subtle borders, soft shadows
- Status bar showing database name, connection status
- Tabbed interface for multiple queries (future)

### UI Development Workflow

**IMPORTANT:** When developing frontend UI code:

1. **Delegate to `frontend-dev` subagent** - Use Task tool with `subagent_type: "frontend-dev"`
2. **Use `frontend-design` skill** - The frontend-dev agent should load this skill for design guidance
3. **Reference solid-launch** - Check `_tmp_solid-launch/` for:
   - Component patterns (`src/components/`)
   - Tailwind configuration and usage
   - Shadcn component setup (`src/components/ui/`)
   - Query patterns (`src/hooks/`)
   - Form handling patterns

### UI Component Structure

```
apps/studio/src/
├── components/
│   ├── ui/                          # Shadcn components (from solid-launch patterns)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── tabs.tsx
│   │   ├── data-table.tsx           # TanStack Table wrapper
│   │   └── ...
│   ├── sql-editor/
│   │   ├── SqlEditor.tsx            # Main editor with vim mode
│   │   ├── EditorToolbar.tsx        # Run button, vim toggle, etc.
│   │   ├── ResultPanel.tsx          # Query results display
│   │   └── QueryHistory.tsx         # History sidebar
│   ├── layout/
│   │   ├── Sidebar.tsx              # Table list, schema tree
│   │   ├── Header.tsx               # DB name, connection status
│   │   └── StatusBar.tsx            # Query stats, row count
│   └── tables/
│       └── TableView.tsx            # Low priority: data grid viewer
├── lib/
│   └── hono-client.ts               # TanStack Query integration
└── styles/
    └── globals.css                  # Tailwind base, custom styles
```

### Shadcn Components to Use

From solid-launch reference, adapt these components:

- `Button` - For actions (run query, clear, etc.)
- `Card` - For panel containers
- `Tabs` - For query tabs
- `Tooltip` - For help hints
- `Resizable` - For split-pane layout (solid-resizable-panels)
- `Sonner` - Toast notifications for errors

## File Structure (Detailed)

```
packages/cli/
├── src/
│   ├── cli.ts           # Main entry, arg parsing
│   ├── server.ts        # Hono server setup
│   └── spacetime.ts     # SpacetimeDB CLI wrapper functions

apps/studio/
├── src/
│   ├── pages/
│   │   ├── +Layout.tsx
│   │   ├── +config.ts
│   │   ├── index/
│   │   │   └── +Page.tsx         # SQL Editor page
│   │   └── tables/
│   │       └── +Page.tsx         # Table viewer (low priority)
│   ├── components/
│   │   ├── sql-editor/
│   │   │   ├── SqlEditor.tsx     # Main editor component
│   │   │   ├── vim-mode.ts       # Vim config
│   │   │   └── sql-theme.ts      # Custom theme
│   │   └── ui/                   # Shadcn components
│   ├── lib/
│   │   └── hono-client.ts        # API client
│   └── server/
│       ├── server.ts             # Server for production
│       └── modules/
│           └── sql/
│               ├── sql.controller.ts
│               └── sql.service.ts
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Development Workflow

1. **Dev mode:**
   - Run `bun run dev` in `apps/studio/` for frontend development
   - Run `bun run dev` in `packages/cli/` for CLI development

2. **Build:**
   - Build studio frontend: `bun run build` in `apps/studio/`
   - Build CLI: `bun run build` in `packages/cli/`

3. **Test:**
   - Start local SpacetimeDB: `spacetime start`
   - Run studio: `spacetime-studio my-db`

## Success Criteria

- [ ] CLI starts successfully with `spacetime-studio [db]`
- [ ] Studio accessible at `localhost:5555`
- [ ] SQL editor with vim mode works
- [ ] Queries execute against SpacetimeDB
- [ ] Results display in result panel
- [ ] Schema (describe) parses correctly
- [ ] Error messages display clearly

## TODOS (after implementing so far... make sure to update this)

[✓] Set up CLI package with dependencies (commander, chalk, hono)
[✓] Implement CLI entry point with argument parsing
[✓] Create apps/studio by duplicating apps/runtime
[✓] Create Hono server with /api/sql and /api/describe endpoints
[✓] Implement SpacetimeDB CLI wrapper functions
[✓] Install TanStack Table, TanStack Query in studio app
[✓] Configure Tailwind and copy Shadcn components from solid-launch
[✓] Build SQL Editor frontend with vim mode
[✓] Build Result Panel component
[✓] Create layout components (Header, Sidebar)
[✓] Wire everything together in main page
[✓] Test CLI startup and basic functionality
[ ] Table viewer (low priority)
[ ] Schema diagram visualization (nice-to-have)
