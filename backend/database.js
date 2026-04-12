const { MongoClient } = require('mongodb');
require('dotenv').config();

const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('whatsapp_bot_2'); 
        console.log('✅ DATABASE: Berhasil terhubung ke MongoDB Atlas (Bot 2)!');
    } catch (error) {
        console.error('❌ DATABASE ERROR: Gagal terhubung ke MongoDB. Cek IP Whitelist di Atlas!');
        console.error(error); 
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

// === FASE 2: MANAJEMEN INVENTARIS ===
async function getInventory() {
    if (!db) return "Database belum siap.";
    try {
        const collection = db.collection('inventory');
        const items = await collection.find({}).toArray();

        if (items.length === 0) return "Gudang saat ini kosong.";

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

async function reduceStock(itemName, quantity) {
    if (!db) return { success: false, message: "Database belum siap." };
    try {
        const collection = db.collection('inventory');

        const item = await collection.findOne({
            item_name: { $regex: new RegExp(`^${itemName}$`, "i") }
        });

        if (!item) {
            return { success: false, message: `Barang '${itemName}' tidak ditemukan di sistem gudang.` };
        }

        if (item.stock < quantity) {
            return { success: false, message: `Gagal! Stok '${itemName}' tidak cukup. Kamu hanya bisa menjual maksimal ${item.stock} pcs.` };
        }

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

// === FASE 3: HUMAN HANDOFF (SAKLAR ADMIN) ===
async function getHumanMode(phoneNumber) {
    if (!db) return false;
    try {
        const session = await db.collection('sessions').findOne({ phone_number: phoneNumber });
        return session ? session.is_human_mode : false;
    } catch (error) {
        console.error("❌ Error getHumanMode:", error);
        return false;
    }
}

// Menyalakan atau mematikan saklar admin untuk nomor WA tertentu
async function setHumanMode(phoneNumber, isHumanMode, lastMessage = "", displayNumber = "") {
    if (!db) return;
    try {
        const updateData = { 
            is_human_mode: isHumanMode,
            last_message: lastMessage,
            updated_at: new Date()
        };

        // Hanya update displayNumber jika datanya ada (biasanya saat saklar ON)
        if (displayNumber) {
            updateData.display_number = displayNumber;
        }

        await db.collection('sessions').updateOne(
            { phone_number: phoneNumber },
            { $set: updateData },
            { upsert: true } // Jika belum ada datanya, buat baru
        );
    } catch (error) {
        console.error("❌ Error setHumanMode:", error);
    }
}

module.exports = { connectDB, getSystemPrompt, getInventory, reduceStock, getHumanMode, setHumanMode };