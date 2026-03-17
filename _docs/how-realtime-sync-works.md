# How SpacetimeDB WebSocket Subscriptions Work (For Dumdums)

## The Problem

You want real-time data sync in your app. When someone inserts/updates/deletes data in a SpacetimeDB table, your browser should automatically update without refreshing.

## The Standard Way vs Our Way

### Standard Way (Generated Bindings)

When you write a SpacetimeDB module in Rust/Python, you run:

```
spacetime generate --lang typescript
```

This creates **static type files** like:

```typescript
// module_bindings/person_table.ts
export default __t.row({
  name: __t.string(),
  age: __t.u64(),
});
```

Your app imports these pre-made files. Done. Simple.

**But wait...** This only works if you:

1. Own the database module source code
2. Can regenerate bindings whenever schema changes
3. Have a fixed schema known at build time

### Our Way (Database Studio)

We're building a **database studio** - a tool that connects to ANY SpacetimeDB database. We don't know the schema ahead of time. The user picks a database at runtime.

So we need to **dynamically generate the schema at runtime** from the database's actual structure.

## How The SDK Works (The Magic)

The SpacetimeDB SDK needs two things to work:

### 1. Remote Module (The Schema)

This tells the SDK:

- What tables exist
- What columns each table has
- What types those columns are
- What reducers (functions) exist

```typescript
const remoteModule = {
  versionInfo: { cliVersion: "2.0.4" },
  tables: { ... },    // table definitions
  reducers: { ... },  // reducer definitions
  procedures: { ... } // procedure definitions
}
```

### 2. The Connection Builder Pattern

```typescript
DbConnection.builder()
  .withUri("ws://localhost:3000")
  .withDatabaseName("my-database")
  .withToken("auth-token-optional")
  .onConnect((connection, identity, token) => {
    // Connected! Now subscribe to data
    connection.db.person.iter(); // Get all person rows
    connection.db.person.onInsert((ctx, row) => {
      /* new row! */
    });
    connection.db.person.onDelete((ctx, row) => {
      /* row deleted */
    });
    connection.db.person.onUpdate((ctx, oldRow, newRow) => {
      /* row changed */
    });
  })
  .build();
```

## The Key Insight: Type Builders

The SDK uses something called **type builders** to define schemas. Think of them as a mini DSL for describing types:

```typescript
// Primitive types
t.string()
t.u64()
t.bool()

// Composite types
t.row({ name: t.string(), age: t.u64() })  // for table rows
t.object({ x: t.u32(), y: t.u32() })         // for data structures
t.array(t.string())                          // list of strings
t.option(t.string())                         // maybe a string

// Table wrapper (adds metadata)
table({ name: "person", indexes: [], constraints: [] }, t.row({ ... }))

// Reducers (functions you can call)
reducerSchema("add_person", { name: t.string() })
```

## Our Runtime Schema Generation

### Step 1: Fetch Database Schema

We call `spacetime describe --json database-name` which returns:

```json
{
  "tables": [{ "name": "person", "product_type_ref": 0 }],
  "typespace": {
    "types": [
      {
        "Product": {
          "elements": [
            { "name": { "some": "name" }, "algebraic_type": { "String": {} } }
          ]
        }
      }
    ]
  }
}
```

This "algebraic type" stuff is SpacetimeDB's internal type representation.

### Step 2: Convert To SDK Type Builders

We recursively translate the algebraic types:

```typescript
function convertAlgebraicType(t, typespace, typeRef) {
  // Primitives
  if (typeRef.String !== undefined) return t.string();
  if (typeRef.U64 !== undefined) return t.u64();
  // ... and so on

  // Composites
  if (typeRef.Product !== undefined) {
    // Build an object/struct type
    const fields = {};
    for (const elem of typeRef.Product.elements) {
      fields[elem.name.some] = convertAlgebraicType(
        t,
        typespace,
        elem.algebraic_type,
      );
    }
    return t.object(undefined, fields);
  }

  // References (types defined elsewhere in typespace)
  if (typeRef.Ref !== undefined) {
    return convertAlgebraicType(t, typespace, typespace[typeRef.Ref]);
  }
}
```

### Step 3: Build The Remote Module

```typescript
async function buildRemoteModule(schema) {
  const {
    t,
    table,
    schema: schemaFn,
    reducers,
    reducerSchema,
    procedures,
  } = await getSdkModules();

  // Build tables
  const tables = {};
  for (const tableInfo of schema.tables) {
    const fields = {};
    for (const column of getColumns(tableInfo)) {
      fields[column.name] = convertAlgebraicType(t, typespace, column.type);
    }
    tables[tableInfo.name] = table(
      { name: tableInfo.name, indexes: [], constraints: [] },
      t.row(fields),
    );
  }

  // Build reducers
  const reducerDefs = [];
  for (const reducer of schema.reducers) {
    const params = {};
    for (const param of reducer.params) {
      params[param.name] = convertAlgebraicType(t, typespace, param.type);
    }
    reducerDefs.push(reducerSchema(reducer.name, params));
  }

  return {
    versionInfo: { cliVersion: "2.0.4" },
    tables: schemaFn(tables).schemaType.tables,
    reducers: reducers(...reducerDefs).reducersType.reducers,
    ...procedures(),
  };
}
```

### Step 4: Create Dynamic DbConnection Class

Now here's where it gets meta. The SDK's `DbConnection` class is designed to work with **static types**. But we need **dynamic types**.

```typescript
// The SDK creates DbConnection instances from remote modules
const DynamicDbConnection = class extends DbConnectionImpl {
  constructor(config) {
    super(config);
  }
};

// The builder takes the remote module and a factory function
const builder = new DbConnectionBuilder(
  remoteModule, // Our dynamically generated schema
  (config) => new DynamicDbConnection(config),
);
```

This pattern lets us pass in a schema we built at runtime instead of one generated at build time.

### Step 5: Connect and Subscribe

```typescript
builder
  .withUri("ws://localhost:3000")
  .withDatabaseName(database)
  .onConnect((connection) => {
    // Now connection.db has our dynamically created tables!
    // connection.db.person
    // connection.db.user
    // etc.
  })
  .build();
```

## The WebSocket Flow

```
┌─────────────┐                 ┌──────────────────┐
│   Browser   │                 │   SpacetimeDB    │
│   (You)     │                 │   Server         │
└──────┬──────┘                 └────────┬─────────┘
       │                                 │
       │  1. WebSocket Connect           │
       │────────────────────────────────>│
       │                                 │
       │  2. Subscribe: "SELECT * FROM   │
       │     person"                     │
       │────────────────────────────────>│
       │                                 │
       │  3. Initial Data (BSATN binary) │
       │<────────────────────────────────│
       │                                 │
       │  SDK decodes using our          │
       │  dynamic schema                 │
       │                                 │
       │  4. Someone else inserts row    │
       │     <────────────────────────  │
       │                                 │
       │  5. Update Event (BSATN)        │
       │<────────────────────────────────│
       │                                 │
       │  onInsert callback fires        │
       │  UI updates automatically       │
       │                                 │
```

## Is This The "Standard" Way?

**For static schemas (normal apps):** No. Use generated bindings.

**For dynamic schemas (database tools, admin panels):** This is the only way. The SDK is designed to support both - it just requires understanding the internal type builder API.

## Why Does This Work?

The SpacetimeDB SDK is built with TypeScript's type system in mind for static use, BUT under the hood it's just JavaScript objects that describe types. These objects ("type builders") can be created at runtime.

The BSATN binary protocol decoder looks at the schema you provide to know how to decode each byte. As long as your schema matches what the server actually has, everything works.

## The Gotchas We Hit

### Gotcha 1: Table Wrapper

Tables need the `table()` wrapper, not just `t.row()`:

```typescript
// WRONG
tables[name] = t.row(fields);

// CORRECT
tables[name] = table({ name, indexes: [], constraints: [] }, t.row(fields));
```

### Gotcha 2: Reducer Params

Reducers take plain objects, not `t.object()`:

```typescript
// WRONG
reducerSchema("add", t.object("Add", { name: t.string() }));

// CORRECT
reducerSchema("add", { name: t.string() });
```

### Gotcha 3: Recursive Type References

Types can reference other types in the typespace:

```typescript
if (typeRef.Ref !== undefined) {
  return convertAlgebraicType(t, typespace, typespace[typeRef.Ref]);
}
```

## Summary

1. **Standard approach**: Generate TypeScript bindings ahead of time
2. **Our approach**: Generate type definitions at runtime from database schema
3. **The key**: The SDK's type builders are just objects we can create dynamically
4. **The result**: Real-time WebSocket subscriptions for any database, any schema
