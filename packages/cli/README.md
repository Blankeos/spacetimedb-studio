# 🛸 SpacetimeDB Studio

A local web-based database studio for [SpacetimeDB](https://spacetimedb.com) — like Drizzle Studio, but for SpacetimeDB.

Run one command and get a full UI to browse your tables, write and execute SQL queries, and inspect your schema.

## Requirements

- [SpacetimeDB CLI](https://spacetimedb.com/install) installed and on your PATH
- A running SpacetimeDB instance with at least one database

## Usage

```bash
npx spacetime-studio <database>
bunx spacetime-studio <database> # or w/ bun (faster)
```

This opens the studio at `http://localhost:5555` pointed at your database.

### Options

```
spacetime-studio [options] [database]

Arguments:
  database              Database name to connect to

Options:
  --db <database>       Database name (alternative to positional argument)
  --port <port>         Port to run the studio on (default: 5555)
  --host <host>         SpacetimeDB host (default: localhost)
  --debug               Show debug path information
  -h, --help            Show help
  -V, --version         Show version
```

### Examples

```bash
# Connect to a database
spacetime-studio my-database

# Custom port
spacetime-studio my-database --port 3000 # WIP

# Custom host
spacetime-studio my-database --host 127.0.0.1 # WIP

# Using the --db flag
spacetime-studio --db my-database
```

## ✨ Features

- 📝 **SQL Editor** — Write and run SQL queries with syntax highlighting and autocompletion
- ⌨️ **Vim mode** — Full Vim keybindings in the editor (toggle in settings)
- 📊 **Results table** — View query results in a sortable, interactive table
- ✏️ **Inline editing** — Click a cell to edit it; generates and runs the UPDATE statement automatically
- 🔍 **Schema inspector** — Browse your tables, columns, and reducers
- ⚡ **Keyboard shortcut** — `Cmd+Enter` / `Ctrl+Enter` to run a query (or just the selection)

## 🛠️ Development

This is a Bun monorepo. To get started:

```bash
bun install

# Run the studio app (hot reload)
bun run dev:studio

# Run the CLI in dev mode
bun run dev:cli

# Build everything
bun run build
```

### Project Structure

```
spacetimedb-studio/
├── apps/
│   └── studio/          # SolidJS + Vike web app (the UI)
└── packages/
    └── cli/             # CLI binary published to npm as spacetime-studio
```

### 📦 Publishing

This project uses [Changesets](https://github.com/changesets/changesets) for versioning.

```bash
# Create a changeset
bun run changeset

# Bump versions
bun run changeset version

# Publish (done automatically via GitHub Actions on merge to main)
bun run publish-ci
```

## License

MIT
