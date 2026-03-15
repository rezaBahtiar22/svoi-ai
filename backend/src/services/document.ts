import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
// @ts-ignore
import pdfExtract from 'pdf-parse-fork';
import { VectorService } from './vector';

export const DocumentService = {
    createChunks(text: string, chunkSize: number = 1200, chunkOverlap: number = 300) {
        const chunks = [];
        let i = 0;

        while (i < text.length) {
            let end = i + chunkSize;
            let chunk = text.substring(i, end);

            if (end < text.length) {
                const lastSpace = chunk.lastIndexOf(' ');
                if (lastSpace > 0) {
                    end = i + lastSpace;
                    chunk = text.substring(i, end);
                }
            }

            chunks.push(chunk.trim());
            i = end - chunkOverlap;

            if (i >= text.length || chunk.length === 0) break;
        }
        return chunks;
    },

    async processUpload(file: File) {
        try {
            const uploadDir = path.resolve('uploads');
            const filePath = path.join(uploadDir, file.name);
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            await writeFile(filePath, buffer);

            let rawText = "";
            let title = "Untitled";

            if (file.type === "application/pdf") {
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                title = pdfDoc.getTitle() || file.name;
                
                const data = await pdfExtract(buffer);
                rawText = data.text;
            } else {
                rawText = new TextDecoder().decode(buffer);
            }

            // Membersihkan teks agar kalimat yang terpisah baris menyambung kembali
            const cleanText = rawText
                .replace(/(\r\n|\n|\r)/gm, " ") // Ubah enter menjadi spasi
                .replace(/\s+/g, " ")           // Ubah spasi ganda menjadi spasi tunggal
                .trim();

            const fullText = `JUDUL ARTIKEL: ${title}\n\nISI DOKUMEN:\n${cleanText}`;

            const chunks = this.createChunks(fullText);

            const chunksWithMetadata = chunks.map(chunk => ({
                text: chunk,
                metadata: {
                    fileName: file.name,
                    uploadedAt: new Date().toISOString()
                }
            }));

            await VectorService.addDocuments(chunksWithMetadata);

            return {
                fileName: file.name,
                totalChunks: chunks.length,
                message: "Dokumen berhasil diproses! Silakan coba chat kembali."
            };
        } catch (error: any) {
            console.error("❌ Svoy-AI Error:", error.message);
            throw new Error(`Gagal memproses dokumen: ${error.message}`);
        }
    }
};