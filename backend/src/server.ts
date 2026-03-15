import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { DocumentService } from "./services/document";
import { VectorService } from './services/vector';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const app = new Elysia()
  .use(cors({
    origin: true,
    credentials: true,
  }))
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "Svoy AI API Documentation",
          version: "1.0.0",
          description: "API for Personal AI Knowledge Base using RAG",
        },
      },
    })
  )
  .group("/api/v1", (app) =>
    app
      .get("/health", () => ({
        status: "ready",
        server: "Bun + Elysia",
        timestamp: new Date().toISOString(),
      }))

      .group("/documents", (app) =>
        app
          .get("/", () => {
            return { message: "List of documents will be here" };
          })
          .post("/upload", async ({ body }) => {
            const { file } = body;
            return await DocumentService.processUpload(file);
          }, {
            body: t.Object({
              file: t.File(),
            }),
            type: "multipart/form-data",
            detail: {
              summary: "Upload and extract text from PDF/TXT file",
              tags: ["Document"],
            }
          })

          .get("/chat", async ({ query }) => {
            const question = query.q as string;
            if (!question) return { error: "Pertanyaan tidak boleh kosong" };

            try {
                const searchResult = await VectorService.search(question);

                if ('message' in searchResult) {
                    return { answer: searchResult.message };
                }

                const contextText = searchResult.map((r: any) => r.text).join("\n\n---\n\n");

                const prompt = `
                    Anda adalah Svoy-AI, asisten yang sangat teliti.
                    Jawablah pertanyaan berdasarkan KONTEKS yang diberikan. 
                    Jika jawaban ada di konteks tetapi kalimatnya tampak terpotong, berikan kesimpulan terbaik dari informasi yang tersedia.
                    Selalu gunakan Bahasa Indonesia yang baik.

                    KONTEKS:
                    ${contextText}

                    PERTANYAAN: 
                    ${question}
                `;

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }]
                        })
                    }
                );

                const data: any = await response.json();

                if (data.error) {
                    throw new Error(`Google API Error: ${data.error.message}`);
                }

                const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, AI tidak memberikan respon.";

                return {
                    answer,
                    sources: [...new Set(searchResult.map((r: any) => r.metadata.fileName))]
                };

            } catch (error: any) {
                console.error("❌ Svoy-AI Error:", error.message);
                return {
                    error: "Gagal memproses permintaan chat.",
                    detail: error.message
                };
            }
          }, {
            detail: {
              summary: "Ask a question to your documents",
              tags: ["Chat"],
            }
          })
          .get("/test-gemini", async () => {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`);
              const data: any = await res.json();
              return data;
          })
      )
  )

export default app;