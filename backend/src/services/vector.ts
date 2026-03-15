import { createClient } from '@supabase/supabase-js';

// API di Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        "❌ Environment variable SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found."
    )
}

const supabase = createClient(supabaseUrl, supabaseKey);

export class VectorService {
    // Model yang menghasilkan 384 dimensi
    private static modelName = 'Xenova/all-MiniLM-L6-v2';

    static async addDocuments(chunks: { text: string; metadata: any }[]) {
        const { pipeline } = await import('@xenova/transformers');
        const extractor = await pipeline('feature-extraction', this.modelName);

        console.log(`⏳ Memproses ${chunks.length} potongan ke Supabase...`);

        for (const chunk of chunks) {
            // Generate koordinat (embedding) untuk setiap teks
            const output = await extractor(chunk.text, {
                pooling: 'mean',
                normalize: true,
            });

            const embedding = Array.from(output.data);

            // Simpan ke tabel 'documents' di Supabase
            const { error } = await supabase
                .from('documents')
                .insert({
                    content: chunk.text,
                    metadata: chunk.metadata,
                    embedding: embedding
                });

            if (error) {
                console.error("❌ Gagal simpan ke Supabase:", error.message);
            }
        }
        console.log("✅ Semua data berhasil disimpan di Supabase secara permanen!");
    }

    static async search(query: string) {
        const { pipeline } = await import('@xenova/transformers');
        const extractor = await pipeline('feature-extraction', this.modelName);

        // Ubah pertanyaan menjadi koordinat vektor
        const output = await extractor(query, {
            pooling: 'mean',
            normalize: true,
        });
        const query_embedding = Array.from(output.data);

        // Panggil fungsi SQL 'match_documents'
        const { data, error } = await supabase.rpc('match_documents', {
            query_embedding: query_embedding,
            match_threshold: 0.5, // Tingkat kemiripan (0.5 = cukup mirip)
            match_count: 5,        // Ambil 5 potongan terbaik
        });

        if (error) {
            console.error("❌ Gagal mencari di Supabase:", error.message);
            return { message: "Terjadi kesalahan saat mencari dokumen." };
        }

        if (!data || data.length === 0) {
            return { message: "Tidak ada informasi yang relevan ditemukan di database." };
        }

        // Format ulang agar sesuai dengan kebutuhan endpoint chat
        return data.map((item: any) => ({
            text: item.content,
            metadata: item.metadata
        }));
    }
}