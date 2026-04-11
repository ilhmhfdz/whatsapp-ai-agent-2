# 🤖 Enterprise-Ready AI Agent Platform: Automated Order Management System (OMS)

![Streamlit](https://img.shields.io/badge/Streamlit-FF4B4B?style=for-the-badge&logo=Streamlit&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![MongoDB Atlas](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![Plotly](https://img.shields.io/badge/Plotly-3F4F75?style=for-the-badge&logo=plotly&logoColor=white)

Sebuah platform *AI Agent* otonom terintegrasi WhatsApp yang dirancang untuk mengotomatisasi layanan pelanggan dan manajemen inventaris. Proyek ini diimplementasikan sebagai *Proof of Concept* (PoC) untuk "Bogor Apparel", mendemonstrasikan bagaimana *Large Language Models* (LLM) dapat berinteraksi dengan *database* melalui arsitektur *Function Calling*.

🌍 **Live Dashboard Demo:** [https://whatsapp-ai-agent-2-9bviymhoh7w3qja2ncv7qg.streamlit.app/]

---

##  Key Features

### 1. 🧠 Agentic AI with Function Calling (Tool Use)
Tidak seperti chatbot statis, sistem ini memiliki *state machine* transaksional. AI diprogram melalui *Prompt Engineering* untuk menahan proses mutasi data (potong stok) hingga pelanggan memberikan konfirmasi pembayaran dan alamat pengiriman. Eksekusi `reduceStock` dilakukan secara otonom oleh LLM (GPT-4o-mini).

### 2. 📊 Real-Time Analytics & Data Visualization
Dilengkapi dengan Control Panel (Dashboard) berbasis **Streamlit** dan divisualisasikan menggunakan **Plotly Express**. Menampilkan *Business Insights* secara *real-time*:
* **KPI Metrics:** Perhitungan valuasi aset dan jumlah fisik barang.
* **Interactive Charts:** Distribusi stok dan pemetaan harga dengan gradasi warna dinamis.
* **Early Warning System:** Klasifikasi otomatis untuk barang *Out of Stock* (Kritis/Merah) dan *Low Stock* (Peringatan/Kuning).

### 3. ⚙️ Decoupled Architecture
Pemisahan tugas (*Separation of Concerns*) secara penuh:
* **Control Plane (Frontend):** Python & Streamlit untuk manajemen data dan analitik.
* **Engine (Backend):** Node.js & `whatsapp-web.js` untuk melayani *concurrent users* di WhatsApp tanpa *delay*.
* **Middleware:** MongoDB Atlas bertindak sebagai jembatan *state management* antara Frontend, Backend, dan AI.

### 4. 🎭 Dynamic Persona & RAG Configuration
Pengguna dapat mengubah *System Prompt* (persona AI) dan *Knowledge Base* langsung melalui *dashboard* tanpa perlu menyentuh kode program atau me-*restart server*.

---

## 🏗️ System Architecture Flow

1. **User Interaction:** Pelanggan mengirim pesan via WhatsApp.
2. **Backend Processing:** Node.js mencegat pesan dan mengambil konfigurasi persona serta data stok terbaru dari MongoDB.
3. **AI Decision Making:** OpenAI menganalisis *intent* pengguna.
   - *Jika tanya jawab:* AI membalas secara natural.
   - *Jika checkout lengkap:* AI memanggil *tool* `reduceStock`.
4. **State Mutation:** Node.js mengeksekusi fungsi pengurangan stok di MongoDB.
5. **Real-time Monitoring:** Perubahan data di MongoDB langsung terefleksi pada Dashboard Streamlit dan grafik analitik.

---

## 🚀 Quick Start / Installation

### Prerequisites
* Node.js (v18+)
* Python (3.9+)
* MongoDB Atlas Account
* OpenAI API Key


### 1. Setup Control Panel (Streamlit)

``` bash 
cd dashboard
pip install -r requirements.txt
# Buat folder .streamlit dan tambahkan file secrets.toml berisi MONGODB_URI
streamlit run app.py
```

### 2. Setup AI Engine (Node.js)
```bash
cd backend-bot2
npm install
# Buat file .env dan isi dengan OPENAI_API_KEY & MONGODB_URI
npm start
# Scan QR Code yang muncul di terminal menggunakan WhatsApp
```

👤 Author
Ilham Hafidz

🎓 B.S. in Informatics

💼 Seeking opportunities in AI Engineering, Data Science, and LLM Development.

📫 Reach out to me via ilhamhafidz666@gmail.com.

