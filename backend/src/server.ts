import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { DocumentService } from "./services/document";
import { VectorService } from './services/vector';
import { Stream } from "@elysiajs/stream";

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

          .get("/chat", ({ query, set }) => {
            const question = (query.q || query.n) as string;
            if (!question) return { error: "Pertanyaan tidak boleh kosong" };

            // Mengatur Header agar browser tidak menganggap ini JSON angka
            set.headers = {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            };

            // Menggunakan Async Generator (async function*) untuk streaming teks murni
            return new Stream(async function* () {
              try {
                const searchResult = await VectorService.search(question);

                if ('message' in searchResult) {
                  yield searchResult.message;
                  return;
                }

                const contextText = searchResult.map((r: any) => 
                  `[Sumber: ${r.metadata?.fileName || 'Dokumen'}]\n${r.text}`
                ).join("\n\n---\n\n");

                const prompt = `
                    Anda adalah Svoy-AI, pakar analisis dokumen akademik.
                    Tugas Anda: Jawab pertanyaan user secara akurat hanya berdasarkan KONTEKS yang diberikan.
                    
                    ATURAN:
                    1. Jika jawaban tidak ada dalam konteks, katakan Anda tidak menemukannya di dokumen.
                    2. Gunakan poin-poin jika menjelaskan langkah teknis.

                    KONTEKS DOKUMEN:
                    ${contextText}

                    PERTANYAAN USER: 
                    ${question}
                `;

                const response = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: prompt }] }],
                      generationConfig: {
                        temperature: 0.2,
                        topP: 0.8,
                      }
                    })
                  }
                );

                if (!response.body) throw new Error("Gagal menerima stream dari Google API");

                const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
                
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const lines = value.split("\n");
                  for (const line of lines) {
                    if (line.startsWith("data: ")) {
                      try {
                        const json = JSON.parse(line.substring(6));
                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                          // 'yield' akan mengirim teks langsung tanpa dibungkus objek JSON angka
                          yield text; 
                        }
                      } catch (e) {
                        // Lewati jika JSON tidak lengkap
                      }
                    }
                  }
                }
              } catch (error: any) {
                console.error("❌ Svoy-AI Stream Error:", error.message);
                yield `Error: ${error.message}`;
              }
            });
          }, {
            detail: {
              summary: "Ask a question to your documents (Streaming)",
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
  .listen(3000);

console.log(`🦊 Svoy AI is running at ${app.server?.hostname}:${app.server?.port}`);

export default app;