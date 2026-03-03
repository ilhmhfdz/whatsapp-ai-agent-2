const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Parameter bertambah: inventoryData (untuk baca stok) dan reduceStockFunc (eksekutor)
async function generateAIResponse(systemPrompt, knowledgeBase, inventoryData, chatHistory, reduceStockFunc) {
    try {
        let finalSystemPrompt = systemPrompt;
        
        if (knowledgeBase && knowledgeBase.trim() !== "") {
            finalSystemPrompt += `\n\n=== INFORMASI TOKO / KNOWLEDGE BASE ===\n${knowledgeBase}`;
        }
        
        // Suntikkan data stok real-time ke otak AI
        if (inventoryData && inventoryData.trim() !== "") {
            finalSystemPrompt += `\n\n${inventoryData}\nPENTING: Jika pelanggan mengonfirmasi ingin membeli barang dan stoknya tersedia, kamu WAJIB memanggil fungsi reduceStock.`;
        }

        const messages = [
            { role: "system", content: finalSystemPrompt },
            ...chatHistory 
        ];

        // 1. Definisikan "Alat" yang bisa dipakai AI
        const tools = [
            {
                type: "function",
                function: {
                    name: "reduceStock",
                    description: "Memotong atau mengurangi stok barang di database ketika pelanggan mengonfirmasi pembelian. Panggil fungsi ini HANYA jika pelanggan sudah deal ingin membeli dan menyebutkan jumlahnya.",
                    parameters: {
                        type: "object",
                        properties: {
                            itemName: {
                                type: "string",
                                description: "Nama barang yang dibeli (harus sama persis dengan yang ada di DAFTAR STOK GUDANG)."
                            },
                            quantity: {
                                type: "integer",
                                description: "Jumlah barang yang dibeli."
                            }
                        },
                        required: ["itemName", "quantity"]
                    }
                }
            }
        ];

        // 2. Panggilan Pertama ke OpenAI
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            tools: tools,
            tool_choice: "auto", // Biarkan AI memutuskan kapan harus pakai alat
            temperature: 0.7,
        });

        const responseMessage = response.choices[0].message;

        // 3. Cek apakah AI memutuskan untuk memanggil fungsi reduceStock
        if (responseMessage.tool_calls) {
            // Masukkan permintaan fungsi dari AI ke dalam riwayat pesan
            messages.push(responseMessage);

            // Eksekusi setiap fungsi yang diminta AI
            for (const toolCall of responseMessage.tool_calls) {
                if (toolCall.function.name === "reduceStock") {
                    // Ambil parameter yang diracik AI (nama barang & jumlah)
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`\n⚙️  [SYSTEM] AI memicu potong stok: ${args.itemName} x ${args.quantity}`);

                    // Eksekusi fungsi database sungguhan!
                    const dbResult = await reduceStockFunc(args.itemName, args.quantity);
                    console.log(`📝 [SYSTEM] Hasil potong stok:`, dbResult);

                    // 4. Masukkan hasil dari database kembali ke obrolan
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        name: "reduceStock",
                        content: JSON.stringify(dbResult) // Beri tau AI hasilnya sukses/gagal
                    });
                }
            }

            // 5. Panggilan Kedua ke OpenAI (Agar AI bisa merangkai kata-kata setelah tau hasilnya)
            const finalResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
            });

            return finalResponse.choices[0].message.content;
        }

        // Jika AI tidak memanggil fungsi (cuma ngobrol biasa)
        return responseMessage.content;

    } catch (error) {
        console.error('❌ Error OpenAI:', error);
        return "Maaf, sistem AI sedang beristirahat sebentar. Silakan coba lagi nanti.";
    }
}

module.exports = { generateAIResponse };