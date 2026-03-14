import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";

const app = new Elysia()
  .use(cors({
    origin: true,
    credentials: true,
  }))
  .use(
    swagger({
      path: "/v1/docs",
      documentation: {
        info: {
          title: "Svoy AI API Documentation",
          version: "1.0.0",
          description: "API for Personal AI Knowledge Base using RAG",
        },
      },
      scalarConfig: {
        spec: {
            url: "/v1/docs/json"
        }
      }
    })
  )

  // Base Routes
  .group("/api/v1", (app) =>
    app
      // Health Check
      .get("/health", () => ({
        status: "ready",
        server: "Bun + Elysia",
        timestamp: new Date().toISOString(),
      }))

      // Knowledge Base Routes (Placeholder sesuai kontrak)
      .group("/documents", (app) =>
        app
          .get("/", () => {
            return { message: "List of documents will be here" };
          })
          .post("/upload", ({ body }) => {
            return { id: "doc_1", status: "processing" };
          }, {
            body: t.Object({
              title: t.String(),
              tags: t.Array(t.String()),
            })
          })
      )

      // Query Route
      .post("/query", ({ body }) => {
        return {
          answer: `You asked: "${body.question}". AI logic coming soon!`,
          sources: []
        };
      }, {
        body: t.Object({
          question: t.String(),
          stream: t.Optional(t.Boolean())
        })
      })
  )

export default app;