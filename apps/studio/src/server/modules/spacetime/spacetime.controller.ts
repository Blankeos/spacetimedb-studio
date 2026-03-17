import { Hono } from "hono"
import { z } from "zod"
import { privateEnv } from "@/env.private"
import { ApiError } from "@/server/lib/error"
import {
  describeDatabase,
  executeMultipleStatements,
  getTablesWithCounts,
} from "./spacetime.service"
import { getSpacetimeConnectionConfig } from "./spacetime-config.service"

const sqlRequestSchema = z.object({
  sql: z.string().min(1),
  database: z.string().min(1),
})

export const spacetimeController = new Hono()
  .get("/config", async (c) => {
    return c.json({
      database: privateEnv.SPACETIME_DB || null,
    })
  })
  .get("/connection/:database", async (c) => {
    const database = c.req.param("database")

    if (!database) {
      throw ApiError.BadRequest("Database name is required")
    }

    try {
      const config = await getSpacetimeConnectionConfig(database)
      return c.json({
        success: true,
        data: config,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get connection config"
      throw ApiError.BadRequest(message)
    }
  })
  .get("/schema/:database", async (c) => {
    const database = c.req.param("database")

    if (!database) {
      throw ApiError.BadRequest("Database name is required")
    }

    try {
      const schema = await describeDatabase(database)
      return c.json({
        success: true,
        data: schema,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get schema"
      throw ApiError.BadRequest(message)
    }
  })
  .post("/sql", async (c) => {
    const body = await c.req.json()
    const parsed = sqlRequestSchema.safeParse(body)

    if (!parsed.success) {
      throw ApiError.BadRequest("Invalid request: sql and database are required")
    }

    const { sql, database } = parsed.data

    try {
      const results = await executeMultipleStatements(database, sql)
      return c.json({
        success: true,
        results,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Query execution failed"
      throw ApiError.BadRequest(message)
    }
  })
  .get("/describe", async (c) => {
    const db = c.req.query("db")

    if (!db) {
      throw ApiError.BadRequest("Database name is required")
    }

    try {
      const result = await describeDatabase(db)
      return c.json({
        success: true,
        data: result,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to describe database"
      throw ApiError.BadRequest(message)
    }
  })
  .get("/tables", async (c) => {
    const db = c.req.query("db")

    if (!db) {
      throw ApiError.BadRequest("Database name is required")
    }

    try {
      const result = await getTablesWithCounts(db)
      return c.json({
        success: true,
        data: result,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get tables"
      throw ApiError.BadRequest(message)
    }
  })
  .get("/query", async (c) => {
    const db = c.req.query("db")
    const table = c.req.query("table")
    const limit = c.req.query("limit")
    const where = c.req.query("where")

    if (!db) {
      throw ApiError.BadRequest("Database name is required")
    }
    if (!table) {
      throw ApiError.BadRequest("Table name is required")
    }

    const limitNum = limit ? parseInt(limit, 10) : 100
    const whereClause = where ? ` WHERE ${where}` : ""

    try {
      const result = await executeMultipleStatements(
        db,
        `SELECT * FROM ${table}${whereClause} LIMIT ${limitNum};`
      )
      return c.json({
        success: true,
        data: result[0]?.data ?? null,
        error: result[0]?.error,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to query table"
      throw ApiError.BadRequest(message)
    }
  })
