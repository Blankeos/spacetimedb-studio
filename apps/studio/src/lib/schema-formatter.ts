type AlgebraicType =
  | { String: [] }
  | { I8: [] }
  | { U8: [] }
  | { I16: [] }
  | { U16: [] }
  | { I32: [] }
  | { U32: [] }
  | { I64: [] }
  | { U64: [] }
  | { I128: [] }
  | { U128: [] }
  | { F32: [] }
  | { F64: [] }
  | { Bool: [] }
  | { Bytes: [] }
  | { Identity: [] }
  | { Address: [] }
  | { Timestamp: [] }
  | { Duration: [] }
  | { Array: [AlgebraicType] }
  | { Option: [AlgebraicType] }
  | { Product: AlgebraicType[] }
  | { Sum: { variants: { name: string; algebraic_type: AlgebraicType }[] } }
  | { Ref: [number] }
  | never

interface TypeElement {
  name: { some: string } | null
  algebraic_type: AlgebraicType
}

interface SpacetimeTable {
  name: string
  product_type_ref: number
  primary_key: { elements: { name: string; algebraic_type: AlgebraicType }[] }[]
  indexes: unknown[]
  constraints: unknown[]
  sequences: unknown[]
  schedule: { none: [] } | { some: unknown }
  table_type: { User: [] } | { system: [] }
  table_access: { Public: [] } | { Private: [] }
}

interface SpacetimeReducer {
  name: string
  params: { elements: TypeElement[] }
  lifecycle: { none: [] } | { some: { Init: [] } | { OnConnect: [] } | { OnDisconnect: [] } }
}

interface SpacetimeDescribe {
  typespace: {
    types: { Product: { elements: TypeElement[] } }[]
  }
  tables: SpacetimeTable[]
  reducers: SpacetimeReducer[]
  types: Array<{
    name: { scope: string[]; name: string }
    ty: number
    custom_ordering: boolean
  }>
  misc_exports: unknown[]
  row_level_security: unknown[]
}

function getTypeName(ty: AlgebraicType, types: SpacetimeDescribe["types"]): string {
  if ("String" in ty) return "string"
  if ("I8" in ty) return "i8"
  if ("U8" in ty) return "u8"
  if ("I16" in ty) return "i16"
  if ("U16" in ty) return "u16"
  if ("I32" in ty) return "i32"
  if ("U32" in ty) return "u32"
  if ("I64" in ty) return "i64"
  if ("U64" in ty) return "u64"
  if ("I128" in ty) return "i128"
  if ("U128" in ty) return "u128"
  if ("F32" in ty) return "f32"
  if ("F64" in ty) return "f64"
  if ("Bool" in ty) return "bool"
  if ("Bytes" in ty) return "bytes"
  if ("Identity" in ty) return "Identity"
  if ("Address" in ty) return "Address"
  if ("Timestamp" in ty) return "Timestamp"
  if ("Duration" in ty) return "Duration"
  if ("Array" in ty) {
    const inner = getTypeName(ty.Array[0] as AlgebraicType, types)
    return `${inner}[]`
  }
  if ("Option" in ty) {
    const inner = getTypeName(ty.Option[0] as AlgebraicType, types)
    return `Option<${inner}>`
  }
  if ("Ref" in ty) {
    const refId = ty.Ref[0]
    const typeInfo = types.find((t) => t.ty === refId)
    if (typeInfo?.name.name) return typeInfo.name.name
    return `Ref<${refId}>`
  }
  return "unknown"
}

function formatReducer(reducer: SpacetimeReducer, types: SpacetimeDescribe["types"]): string {
  const params = reducer.params.elements.map((el) => {
    const name = el.name?.some ?? "_"
    const typeName = getTypeName(el.algebraic_type, types)
    return `  ${name}: ${typeName}`
  })

  let lifecycle = ""
  if ("some" in reducer.lifecycle) {
    const lc = reducer.lifecycle.some
    if ("Init" in lc) lifecycle = " // @lifecycle Init"
    else if ("OnConnect" in lc) lifecycle = " // @lifecycle OnConnect"
    else if ("OnDisconnect" in lc) lifecycle = " // @lifecycle OnDisconnect"
  }

  const paramsStr = params.length > 0 ? `{\n${params.join(",\n")}\n}` : ""
  return `reducer ${reducer.name}(${paramsStr})${lifecycle}`
}

function formatTable(table: SpacetimeTable, describe: SpacetimeDescribe): string {
  const typeDef = describe.typespace.types[table.product_type_ref]
  if (!typeDef || !("Product" in typeDef)) {
    return `table ${table.name} { /* unable to resolve columns */ }`
  }

  const elements = typeDef.Product.elements
  const primaryKey = table.primary_key?.[0]?.elements?.map((e) => e.name) || []
  const access = "Public" in table.table_access ? "public" : "private"
  const type = "User" in table.table_type ? "user" : "system"

  const columns = elements.map((el) => {
    const name = el.name?.some ?? "_"
    const typeName = getTypeName(el.algebraic_type, describe.types)
    const isPrimary = primaryKey.includes(name)
    const suffix = isPrimary ? " @primary" : ""
    return `  ${name}: ${typeName}${suffix}`
  })

  const header = `// table: ${table.name} (${type}, ${access})`
  const body = columns.join(",\n")

  return `${header}\ntable ${table.name} {\n${body}\n}`
}

export function formatSchemaAsCode(describe: SpacetimeDescribe): string {
  const sections: string[] = []

  const userTables = describe.tables.filter((t) => "User" in t.table_type)
  const systemTables = describe.tables.filter((t) => !("User" in t.table_type))

  if (userTables.length > 0) {
    sections.push("//\n// Tables (User)\n//")
    userTables.forEach((table) => {
      sections.push(formatTable(table, describe))
    })
  }

  if (systemTables.length > 0) {
    sections.push("\n//\n// Tables (System)\n//")
    systemTables.forEach((table) => {
      sections.push(formatTable(table, describe))
    })
  }

  const explicitReducers = describe.reducers.filter(
    (r) => r.name !== "init" && r.name !== "on_connect" && r.name !== "on_disconnect"
  )
  const lifecycleReducers = describe.reducers.filter(
    (r) =>
      r.name === "init" ||
      r.name === "on_connect" ||
      r.name === "on_disconnect" ||
      ("some" in r.lifecycle && Object.keys(r.lifecycle.some).length > 0)
  )

  if (explicitReducers.length > 0) {
    sections.push("\n//\n// Reducers\n//")
    explicitReducers.forEach((reducer) => {
      sections.push(formatReducer(reducer, describe.types))
    })
  }

  if (lifecycleReducers.length > 0) {
    sections.push("\n//\n// Lifecycle Hooks\n//")
    lifecycleReducers.forEach((reducer) => {
      sections.push(formatReducer(reducer, describe.types))
    })
  }

  return sections.join("\n\n")
}

export type { SpacetimeDescribe, SpacetimeTable, SpacetimeReducer, TypeElement, AlgebraicType }
