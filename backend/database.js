const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectDB() {
    try {
        await client.connect();
        // Memastikan tetap menggunakan database bot
        db = client.db('whatsapp_bot_2'); 
        console.log('✅ Terhubung ke MongoDB Atlas (Bot 2)');
    } catch (error) {
        console.error('❌ Gagal terhubung ke MongoDB:', error);
    }
}

async function getSystemPrompt() {
    const defaultConfig = { prompt: "Kamu adalah asisten AI yang ramah.", knowledgeBase: "" };
    if (!db) return defaultConfig; 
    
    try {
        const collection = db.collection('agent_config');
        const config = await collection.findOne({ type: 'system_prompt' });
        
        return config ? {
            prompt: config.prompt || defaultConfig.prompt,
            knowledgeBase: config.knowledge_base || ""
        } : defaultConfig;
    } catch (error) {
        console.error("❌ Gagal mengambil konfigurasi dari database:", error);
        return defaultConfig;
    }
}

// === FUNGSI BARU FASE 2: MANAJEMEN INVENTARIS ===

// 1. Fungsi untuk membaca ketersediaan stok agar AI tahu
async function getInventory() {
    if (!db) return "Database belum siap.";
    try {
        const collection = db.collection('inventory');
        const items = await collection.find({}).toArray();

        if (items.length === 0) return "Gudang saat ini kosong.";

        // Format data menjadi teks yang rapi agar AI gampang membacanya
        let inventoryText = "DAFTAR STOK GUDANG REAL-TIME:\n";
        items.forEach(item => {
            inventoryText += `- ${item.item_name} | Stok: ${item.stock} pcs | Harga: Rp${item.price}\n`;
        });
        return inventoryText;
    } catch (error) {
        console.error("❌ Gagal mengambil data inventaris:", error);
        return "Terjadi kesalahan saat membaca gudang.";
    }
}

// 2. Fungsi 'Action' untuk memotong stok di database
async function reduceStock(itemName, quantity) {
    if (!db) return { success: false, message: "Database belum siap." };
    try {
        const collection = db.collection('inventory');

        // Cari barang dengan nama persis atau mirip (case insensitive)
        const item = await collection.findOne({
            item_name: { $regex: new RegExp(`^${itemName}$`, "i") }
        });

        // Validasi: Apakah barang ada?
        if (!item) {
            return { success: false, message: `Barang '${itemName}' tidak ditemukan di sistem gudang.` };
        }

        // Validasi: Apakah stok cukup?
        if (item.stock < quantity) {
            return { success: false, message: `Gagal! Stok '${itemName}' tidak cukup. Kamu hanya bisa menjual maksimal ${item.stock} pcs.` };
        }

        // Eksekusi potong stok (-quantity)
        await collection.updateOne(
            { _id: item._id },
            { $inc: { stock: -quantity } }
        );

        return { 
            success: true, 
            message: `Berhasil memotong ${quantity} pcs stok '${itemName}'. Sisa stok di gudang sekarang: ${item.stock - quantity} pcs.` 
        };
    } catch (error) {
        console.error("❌ Gagal memotong stok:", error);
        return { success: false, message: "Terjadi kesalahan sistem saat memotong stok." };
    }
}

module.exports = { connectDB, getSystemPrompt, getInventory, reduceStock };