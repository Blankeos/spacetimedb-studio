# spacetimedb-studio

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.10. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

# Build Pipeline

## Development

cd packages/cli && bun run src/cli.ts vike-ts

## Production binary

cd packages/cli && bun run build
./dist/spacetime-studio my-database
