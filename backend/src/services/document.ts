import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
// @ts-ignore
import pdfExtract from 'pdf-parse-fork';
import { VectorService } from './vector';

export const DocumentService = {
    createChunks(text: string, chunkSize: number = 1500, chunkOverlap: number = 300) {
        const chunks = [];
        let i = 0;

        while (i < text.length) {
            // tentukan batas akhir sementara
            let end = i + chunkSize;
            
            // jika sudah di ujung teks, ambil sisanya
            if (end >= text.length) {
                chunks.push(text.substring(i).trim());
                break;
            }

            // CARI TITIK TERDEKAT (agar potongan berhenti di akhir kalimat)
            // cari titik dalam rentang overlap agar potongan tetap rapi
            let chunk = text.substring(i, end);
            let lastPoint = chunk.lastIndexOf('.');
            
            // jika ada titik dalam 200 karakter terakhir dari chunk, potong di sana
            if (lastPoint > chunkSize - 200) {
                end = i + lastPoint + 1;
            } else {
                // jika tidak ada titik, cari spasi terakhir agar tidak memotong kata
                let lastSpace = chunk.lastIndexOf(' ');
                if (lastSpace > 0) {
                    end = i + lastSpace;
                }
            }

            chunks.push(text.substring(i, end).trim());
            
            // geser i untuk chunk berikutnya dengan overlap
            i = end - chunkOverlap;

            // safety break jika terjadi infinite loop
            if (i >= text.length || end <= i) break;
        }
        
        // filter chunk yang terlalu pendek (sampah ekstraksi)
        return chunks.filter(c => c.length > 50);
    },

    async processUpload(file: File) {
        try {
            const uploadDir = path.resolve('uploads');
            const filePath = path.join(uploadDir, file.name);
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            await writeFile(filePath, buffer);

            let rawText = "";
            let title = "";
            let contributorInfo = "";

            const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");

            if (file.type === "application/pdf") {
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const internalTitle = pdfDoc.getTitle();
                
                const data = await pdfExtract(buffer);
                rawText = data.text;

                // membersihkan baris untuk ekstraksi judul & penulis
                const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 5);

                // STRATEGI HYBRID TITLE
                if (fileNameWithoutExt.length > 20) {
                    title = fileNameWithoutExt;
                } else if (internalTitle && internalTitle !== "Untitled") {
                    title = internalTitle;
                } else {
                    title = lines[0] || fileNameWithoutExt;
                }

                contributorInfo = lines.slice(1, 6).join(", ");
            } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                const result = await mammoth.extractRawText({ buffer: buffer });
                rawText = result.value; // hasil ekstraksi teks dari Word
                
                const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 5);
                
                // menggunakan strategi hybrid
                title = fileNameWithoutExt.length > 20 ? fileNameWithoutExt : (lines[0] || fileNameWithoutExt);
                contributorInfo = lines.slice(1, 6).join(", ");
            } else {
                rawText = new TextDecoder().decode(buffer);
                title = file.name;
            }

            // membersihkan teks isi
            const cleanText = rawText
                .replace(/(\r\n|\n|\r)/gm, " ")
                .replace(/\s+/g, " ")
                .trim();

            /**
             * METADATA ENRICHMENT:
             * menempelkan identitas di setiap potongan teks.
             */
            const fullText = `Dokumen: ${title}. Penulis: ${contributorInfo}. Isi: ${cleanText}`;

            const chunks = this.createChunks(fullText);

            const chunksWithMetadata = chunks.map(chunk => ({
                text: chunk,
                metadata: {
                    fileName: file.name,
                    title: title,
                    uploadedAt: new Date().toISOString()
                }
            }));

            await VectorService.addDocuments(chunksWithMetadata);

            return {
                fileName: file.name,
                totalChunks: chunks.length,
                message: "Dokumen berhasil diproses!"
            };
        } catch (error: any) {
            console.error("❌ Svoy-AI Error:", error.message);
            throw new Error(`Gagal memproses dokumen: ${error.message}`);
        }
    }
};