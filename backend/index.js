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
    const isHumanMode = await getHumanMode(userId);
    if (isHumanMode) {
        console.log(`⏸️ [HUMAN MODE] Mengabaikan pesan dari ${userId}. Menunggu balasan Admin.`);
        return; 
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
            // 1. Tarik informasi kontak asli dari WhatsApp
            const contact = await message.getContact();
            
            // 2. Ambil nomor aslinya. Jika gagal, ambil pushname/nama profilnya.
            const realNumber = contact.number || contact.pushname || userId.split('@')[0];

            // 3. Simpan ke database (userId untuk mesin, realNumber untuk ditampilkan ke admin)
            await setHumanMode(userId, true, message.body, realNumber);
            console.log(`✅ [DB] Mode Manusia DIAKTIFKAN untuk pelanggan: ${realNumber}`);
        };

        // Panggil AI dengan parameter lengkap
        const aiReply = await generateAIResponse(
            dbData.prompt, 
            dbData.knowledgeBase, 
            inventoryData, 
            userHistory, 
            reduceStock,
            executeTransferToHuman 
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