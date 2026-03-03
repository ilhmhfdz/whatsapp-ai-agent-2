const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { connectDB, getSystemPrompt, getInventory, reduceStock } = require('./database');
const { generateAIResponse } = require('./ai');
const express = require('express');

const app = express();
const port = process.env.PORT || 3001; // Port Bot 2
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
    console.log('✅ Bot WhatsApp (Versi Manajemen Stok) sudah siap!');
});

client.on('message', async message => {
    if (message.from.includes('@g.us') || message.from === 'status@broadcast') return;

    const userId = message.from; 

    if (!chatMemory.has(userId)) {
        chatMemory.set(userId, []);
    }

    const userHistory = chatMemory.get(userId);
    userHistory.push({ role: "user", content: message.body });

    if (userHistory.length > MAX_HISTORY) {
        userHistory.shift(); 
    }

    try {
        // 1. Ambil config & prompt
        const dbData = await getSystemPrompt();
        
        // 2. Ambil data stok real-time dari gudang
        const inventoryData = await getInventory();
        
        // 3. Panggil AI, masukkan semua data & LEMPAR FUNGSI POTONG STOK sebagai parameter
        const aiReply = await generateAIResponse(
            dbData.prompt, 
            dbData.knowledgeBase, 
            inventoryData, 
            userHistory, 
            reduceStock
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