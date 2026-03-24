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
            const question = (query.q || query.n) as string;
            if (!question) return { error: "Pertanyaan tidak boleh kosong" };

            try {
                // 1. Ambil konteks lebih banyak (match_count: 15)
                const searchResult = await VectorService.search(question);

                if ('message' in searchResult) {
                    return { answer: searchResult.message };
                }

                const contextText = searchResult.map((r: any) => 
                    `[Sumber: ${r.metadata.fileName || 'Dokumen'}]\n${r.text}`
                ).join("\n\n---\n\n");

                // 2. Prompt yang lebih 'galak' dan terstruktur
                const prompt = `
                    Anda adalah Svoy-AI, pakar analisis dokumen akademik.
                    Tugas Anda: Jawab pertanyaan user secara akurat hanya berdasarkan KONTEKS yang diberikan.
                    
                    ATURAN:
                    1. Jika jawaban tidak ada dalam konteks, katakan Anda tidak menemukannya di dokumen, jangan mengarang.
                    2. Jika informasi dalam konteks terpotong, sambungkan dengan logika yang paling masuk akal.
                    3. Gunakan poin-poin jika menjelaskan langkah teknis atau daftar.
                    4. Identifikasi istilah teknis (seperti SVM, Hashing, dll) sesuai penjelasan di dokumen.

                    KONTEKS DOKUMEN:
                    ${contextText}

                    PERTANYAAN USER: 
                    ${question}
                `;

                // 3. Gunakan model gemini-1.5-flash (lebih stabil)
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: {
                                temperature: 0.2, // Rendah agar AI tidak kreatif (lebih jujur pada data)
                                topP: 0.8,
                            }
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