const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { connectDB, getSystemPrompt, getInventory, reduceStock, getHumanMode, setHumanMode } = require('./database');
const { generateAIResponse } = require('./ai');
const express = require('express');

const app = express();
const port = process.env.PORT || 3001; 
app.get('/', (req, res) => res.send('🚀 Mesin Bot WhatsApp AI 2 (OMS Edition) sedang berjalan!'));
app.listen(port, () => console.log(`🌍 Web server aktif di port ${port}`));

const client = new Client({ 
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

const chatMemory = new Map(); 
const MAX_HISTORY = 10; 

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Silakan scan QR Code di atas!');
});

client.on('ready', () => {
    console.log('✅ Bot WhatsApp (Versi Manajemen Stok & CS) sudah siap!');
});

client.on('message', async message => {
    // Abaikan pesan dari grup atau status
    if (message.from.includes('@g.us') || message.from === 'status@broadcast') return;

    const userId = message.from; 

    // 🚨 SAKLAR UTAMA (HUMAN HANDOFF GUARD)
    // Mengecek database: Apakah admin sedang mengurus pelanggan ini?
    const isHumanMode = await getHumanMode(userId);
    if (isHumanMode) {
        console.log(`⏸️ [HUMAN MODE] Mengabaikan pesan dari ${userId}. Menunggu balasan Admin.`);
        return; // Hentikan eksekusi di sini. AI sama sekali tidak dipanggil.
    }

    if (!chatMemory.has(userId)) {
        chatMemory.set(userId, []);
    }

    const userHistory = chatMemory.get(userId);
    userHistory.push({ role: "user", content: message.body });

    if (userHistory.length > MAX_HISTORY) {
        userHistory.shift(); 
    }

    try {
        const dbData = await getSystemPrompt();
        const inventoryData = await getInventory();
        
        // Fungsi pembungkus (wrapper) untuk alat transfer AI
        const executeTransferToHuman = async (reason) => {
            // Ubah saklar di database jadi TRUE, dan simpan pesan keluhan terakhir
            await setHumanMode(userId, true, message.body);
            console.log(`✅ [DB] Mode Manusia DIAKTIFKAN untuk ${userId}`);
        };

        // Panggil AI dengan parameter lengkap
        const aiReply = await generateAIResponse(
            dbData.prompt, 
            dbData.knowledgeBase, 
            inventoryData, 
            userHistory, 
            reduceStock,
            executeTransferToHuman // Inject alat pengalihan ke manusia
        );

        userHistory.push({ role: "assistant", content: aiReply });
        message.reply(aiReply);
    } catch (error) {
        console.error('❌ Terjadi kesalahan saat memproses pesan:', error);
        message.reply("Maaf, sistem kasir sedang sibuk. Silakan coba sebentar lagi.");
    }
});

connectDB().then(() => {
    client.initialize();
});
