import { createClient } from '@supabase/supabase-js';

// API di Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        "❌ Environment variable SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found."
    )
}

const supabase = createClient(supabaseUrl, supabaseKey);

export class VectorService {
    // model yang menghasilkan 384 dimensi
    private static modelName = 'Xenova/all-MiniLM-L6-v2';

    static async addDocuments(chunks: { text: string; metadata: any }[]) {
        const { pipeline } = await import('@xenova/transformers');
        const extractor = await pipeline('feature-extraction', this.modelName);

        console.log(`⏳ Memproses ${chunks.length} potongan...`);

        // gunakan .entries() supaya kita punya akses ke index (i) dan data (chunk) sekaligus
        for (const [i, chunk] of chunks.entries()) {

            const output = await extractor(chunk.text, {
                pooling: 'mean',
                normalize: true,
            });

            const embedding = Array.from(output.data);

            const { error } = await supabase
                .from('documents')
                .insert({
                    content: chunk.text,
                    metadata: chunk.metadata,
                    embedding: embedding
                });

            if (error) {
                console.error("❌ Error:", error.message);

                // jika error "Too Many Requests", beri jeda sedikit
                if (error.message.includes('429')) {
                    await new Promise(res => setTimeout(res, 2000));
                }
            }
            
            // Perbaikan Log Progress: Menampilkan angka yang benar
            if (i % 10 === 0 || i === chunks.length - 1) {
                console.log(` ✅ Progress: ${i + 1}/${chunks.length} potongan tersimpan...`);
            }
        }
        console.log("✅ Selesai! Seluruh document berhasil masuk database.");
    }

    static async search(query: string) {
        const { pipeline } = await import('@xenova/transformers');
        const extractor = await pipeline('feature-extraction', this.modelName);

        const output = await extractor(query, {
            pooling: 'mean',
            normalize: true,
        });
        const query_embedding = Array.from(output.data);

        const { data, error } = await supabase.rpc('match_documents', {
            query_embedding: query_embedding,
            match_threshold: 0.3, // naikkan dari 0.2 agar lebih akurat
            match_count: 15,      // sudah benar menggunakan 15 untuk tinjauan pustaka yang lengkap
        });

        if (error) {
            console.error("❌ Gagal mencari di Supabase:", error.message);
            return { message: "Terjadi kesalahan saat mencari dokumen." };
        }

        if (!data || data.length === 0) {
            return { message: "Tidak ada informasi yang relevan ditemukan di database." };
        }

        return data.map((item: any) => ({
            text: item.content,
            metadata: item.metadata
        }));
    }
}