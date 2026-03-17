import { Hono } from "hono"
import { cors } from "hono/cors"
import { spacetimeController } from "./modules/spacetime/spacetime.controller"

const app = new Hono()

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5555",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5555",
    ],
  })
)

export const appRouter = app.route("/spacetime", spacetimeController)

export type AppRouter = typeof appRouter
