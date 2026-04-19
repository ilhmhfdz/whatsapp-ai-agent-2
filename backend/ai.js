const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Parameter bertambah: transferToHumanFunc
async function generateAIResponse(systemPrompt, knowledgeBase, inventoryData, chatHistory, reduceStockFunc, transferToHumanFunc) {
    try {
        let finalSystemPrompt = systemPrompt;
        
        // [BACKEND GUARD] Cek apakah stok sudah dipotong sebelumnya
        const isOrderAlreadyProcessed = chatHistory.some(msg => 
            msg.role === "assistant" && 
            msg.content && 
            (msg.content.toLowerCase().includes("amankan") || 
             msg.content.toLowerCase().includes("siap dikirim") ||
             msg.content.toLowerCase().includes("terima kasih udah belanja"))
        );

        if (knowledgeBase && knowledgeBase.trim() !== "") {
            finalSystemPrompt += `\n\n=== INFORMASI TOKO / KNOWLEDGE BASE ===\n${knowledgeBase}`;
        }
        
        if (inventoryData && inventoryData.trim() !== "") {
            finalSystemPrompt += `\n\n=== DATA STOK GUDANG ===\n${inventoryData}\n
ATURAN MUTLAK (STRICT RULES):
1. Panggil tool 'reduceStock' HANYA SATU KALI, yaitu tepat saat pelanggan PERTAMA KALI mengonfirmasi pembayaran/checkout.
2. JIKA pelanggan hanya menambahkan informasi (seperti alamat pengiriman) SETELAH melakukan pembayaran, DILARANG KERAS memanggil tool 'reduceStock' lagi. Cukup konfirmasi alamatnya.
3. JANGAN PERNAH membalas dengan kalimat "Pesanan diamankan" atau "Pesanan diproses" SEBELUM kamu berhasil memanggil tool 'reduceStock'.`;

            if (isOrderAlreadyProcessed) {
                finalSystemPrompt += `\n\n[STATUS SISTEM]: Kamu SUDAH berhasil memotong stok pesanan ini di obrolan sebelumnya. JANGAN PERNAH memanggil fungsi 'reduceStock' lagi di balasan ini!`;
            }
        }

        const messages = [
            { role: "system", content: finalSystemPrompt },
            ...chatHistory 
        ];

        // Definisikan 2 Alat: Potong Stok & Panggil Manusia
        const tools = [
            {
                type: "function",
                function: {
                    name: "reduceStock",
                    description: "Memotong stok barang di database. HANYA panggil 1x saat pertama kali deal.",
                    parameters: {
                        type: "object",
                        properties: {
                            itemName: { type: "string", description: "Nama barang yang dibeli." },
                            quantity: { type: "integer", description: "Jumlah barang yang dibeli." }
                        },
                        required: ["itemName", "quantity"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "transferToHuman",
                    description: "Panggil fungsi ini HANYA JIKA pelanggan marah, komplain, menanyakan hal rumit di luar Knowledge Base, atau eksplisit meminta bicara dengan CS/Admin/Manusia. Ini akan mematikan AI.",
                    parameters: {
                        type: "object",
                        properties: {
                            reason: { type: "string", description: "Alasan pengalihan (misal: 'komplain barang', 'tanya grosir')." }
                        },
                        required: ["reason"]
                    }
                }
            }
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            tools: tools,
            tool_choice: "auto", 
            temperature: 0.2, // Temperature rendah agar AI stabil
        });

        const responseMessage = response.choices[0].message;

        // Cek eksekusi tool
        if (responseMessage.tool_calls) {
            messages.push(responseMessage);

            for (const toolCall of responseMessage.tool_calls) {
                
                // 1. Tool Potong Stok
                if (toolCall.function.name === "reduceStock") {
                    if (isOrderAlreadyProcessed) {
                        console.log(`[SYSTEM BLOCK] AI mencoba memotong stok ganda. Eksekusi dicegah!`);
                        messages.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            name: "reduceStock",
                            content: JSON.stringify({ success: false, message: "Stok untuk pesanan ini sudah pernah dipotong." })
                        });
                        continue; 
                    }

                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`\n [SYSTEM] AI memicu potong stok: ${args.itemName} x ${args.quantity}`);
                    const dbResult = await reduceStockFunc(args.itemName, args.quantity);
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        name: "reduceStock",
                        content: JSON.stringify(dbResult)
                    });
                }
                
                // 2. Tool Panggil Manusia
                if (toolCall.function.name === "transferToHuman") {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log(`\n [SYSTEM] AI mengalihkan chat ke Admin. Alasan: ${args.reason}`);
                    
                    // Nyalakan saklar di database via fungsi index.js
                    await transferToHumanFunc(args.reason);

                    messages.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        name: "transferToHuman",
                        content: JSON.stringify({ success: true, message: "Sistem telah beralih ke Mode Manusia. Berikan respons perpisahan ramah yang meminta pelanggan menunggu admin." })
                    });
                }
            }

            const finalResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
            });

            return finalResponse.choices[0].message.content;
        }

        return responseMessage.content;

    } catch (error) {
        console.error('Error OpenAI:', error);
        return "Maaf, sistem AI sedang beristirahat sebentar. Silakan coba lagi nanti.";
    }
}

module.exports = { generateAIResponse };
