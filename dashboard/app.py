import streamlit as st
import pandas as pd
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import certifi
import PyPDF2
import plotly.express as px

load_dotenv()

try:
    MONGO_URI = st.secrets["MONGODB_URI"]
except:
    MONGO_URI = os.getenv("MONGODB_URI")

st.set_page_config(page_title="AI Agent Dashboard", page_icon="💬", layout="wide")

@st.cache_resource
def init_connection():
    return MongoClient(MONGO_URI, tlsCAFile=certifi.where())

try:
    client = init_connection()
    db = client['whatsapp_bot_2'] # Menggunakan database bot
    collection = db['agent_config']
    inventory_col = db['inventory'] # Collection baru untuk stok barang
    session_col = db['sessions'] # Collection baru untuk sesi chat & saklar admin
except Exception as e:
    st.error(f"❌ Gagal terhubung ke MongoDB: {e}")
    st.stop()

# --- SIDEBAR ---
with st.sidebar:
    st.markdown(" **Live Demo**")
    st.link_button(" Test Bot di WhatsApp(klik disini)", "https://wa.me/6285121571837", type="primary", use_container_width=True)
    st.header("⚙️ Status Sistem")
    st.success(" MongoDB: Terhubung")
    st.info(" Model: GPT-4o-mini (Tools Enabled)")
# --- MAIN LAYOUT ---
st.title("Control Panel AI Agent")
st.markdown("Sistem Manajemen Order Cerdas. AI dapat membaca dan memotong stok secara otomatis.")
st.divider()

# Tarik data config
current_config = collection.find_one({"type": "system_prompt"})
default_prompt = current_config["prompt"] if current_config else "Kamu adalah Customer Service toko..."
current_kb = current_config.get("knowledge_base", "") if current_config else ""

# Empat Tabs (Ditambah tab Live CS & Handoff)
tab1, tab2, tab3, tab4 = st.tabs(["Manajemen Stok", "Konfigurasi Prompt", "Insight & Analitik Toko", "🎧 Live CS & Handoff"])

# TAB 1: MANAJEMEN STOK
with tab1:
    st.subheader(" Gudang & Inventaris Toko (Interactive Mode)")
    st.markdown("Silakan klik langsung pada sel tabel di bawah untuk mengubah **Nama**, **Stok**, atau **Harga**. Kamu juga bisa **menambah baris baru** di bagian paling bawah tabel, atau mencentang baris untuk menghapusnya.")
    
    # 1. Tarik data dari MongoDB
    items = list(inventory_col.find({}, {"_id": 0}))
    
    # Siapkan DataFrame kosong jika gudang belum ada isinya
    if items:
        df = pd.DataFrame(items)
        df = df[['item_name', 'stock', 'price']] # Pastikan urutannya benar
    else:
        df = pd.DataFrame(columns=['item_name', 'stock', 'price'])
        
    # nama kolom
    df.columns = ['Nama Barang', 'Stok Tersedia', 'Harga (Rp)']

    # 2. Tampilkan INTERACTIVE DATA EDITOR
    edited_df = st.data_editor(
        df,
        use_container_width=True,
        num_rows="dynamic", # Mengizinkan user tambah/hapus baris langsung di tabel
        hide_index=True,
        height=300
    )

    # 3. Tombol Eksekusi
    col_btn1, col_btn2, col_space = st.columns([2, 2, 4])
    
    with col_btn1:
        if st.button("Simpan Perubahan Tabel", type="primary", use_container_width=True):
            try:
                # Strategi Sinkronisasi: Kosongkan gudang lama, masukkan data dari tabel baru
                inventory_col.delete_many({})
                
                if not edited_df.empty:
                    # Kembalikan nama kolom ke format database (bahasa Inggris)
                    records = edited_df.rename(columns={
                        'Nama Barang': 'item_name',
                        'Stok Tersedia': 'stock',
                        'Harga (Rp)': 'price'
                    }).to_dict('records')
                    
                    # Masukkan kembali ke MongoDB
                    inventory_col.insert_many(records)

                st.success("✅ Database Gudang berhasil diperbarui secara massal!")
                st.rerun() # Refresh halaman
            except Exception as e:
                st.error(f"❌ Gagal menyimpan perubahan: {e}")

    with col_btn2:
        if st.button("⚠️ Kosongkan Semua", use_container_width=True):
            inventory_col.delete_many({})
            st.rerun()

# TAB 2: KONFIGURASI PROMPT
with tab2:
    st.subheader("📝 Instruksi Utama (System Prompt)")
    
    with st.form("prompt_form"):
        new_prompt = st.text_area("Tentukan persona bot:", value=default_prompt, height=200)
        uploaded_file = st.file_uploader("Upload PDF Knowledge Base (Opsional, MAKSIMAL 3 Halaman PDF)", type=["pdf"])
        submit_prompt = st.form_submit_button(label=" Simpan Konfigurasi", use_container_width=True)

        if submit_prompt:
            extracted_text = current_kb 
            # Jika ada file baru, timpa teks yang lama
            if uploaded_file is not None:
                try:
                    pdf_reader = PyPDF2.PdfReader(uploaded_file)
                    extracted_text = "".join([page.extract_text() + "\n" for page in pdf_reader.pages if page.extract_text()])
                except Exception as e:
                    st.error(f"Gagal membaca PDF: {e}")
                    
            collection.update_one(
                {"type": "system_prompt"},
                {"$set": {"prompt": new_prompt, "knowledge_base": extracted_text}},
                upsert=True 
            )
            st.success("✅ Konfigurasi bot tersimpan!")
            st.rerun() # Refresh halaman agar data terbaru langsung termuat

    # === TOMBOL HAPUS KNOWLEDGE BASE ===
    st.markdown("---")
    st.subheader("Manajemen Memori Knowledge Base")
    
    if current_kb and current_kb.strip() != "":
        st.warning("⚠️ Saat ini ada Knowledge Base (PDF lama) yang masih melekat di otak bot.")
        with st.expander("Intip isi Knowledge Base saat ini"):
            st.write(current_kb[:300] + "... (teks dipotong)")
        
        # Tombol hapus terpisah dari form utama
        if st.button("Hapus Knowledge Base dari Otak Bot", type="primary"):
            collection.update_one(
                {"type": "system_prompt"},
                {"$set": {"knowledge_base": ""}} # Kosongkan isi knowledge base
            )
            st.success("✅ Memori Knowledge Base berhasil dibersihkan!")
            st.rerun() # Refresh halaman
    else:
        st.info("✅ Memori aman. Tidak ada Knowledge Base / PDF yang tersimpan saat ini.")


# TAB 3: INSIGHT & ANALITIK
with tab3:
    st.subheader("Insight & Analitik Toko")
    st.markdown("Pantau performa inventaris, valuasi aset, dan peringatan stok secara *real-time*.")

    # Ambil ulang data terbaru dari MongoDB
    items_analytics = list(inventory_col.find({}, {"_id": 0}))

    if items_analytics:
        df_analytics = pd.DataFrame(items_analytics)
        
        # Pastikan tipe data benar untuk kalkulasi matematis
        df_analytics['stock'] = pd.to_numeric(df_analytics['stock'], errors='coerce').fillna(0)
        df_analytics['price'] = pd.to_numeric(df_analytics['price'], errors='coerce').fillna(0)

        # --- 1. KPI METRICS (Ringkasan Eksekutif) ---
        col_kpi1, col_kpi2, col_kpi3 = st.columns(3)
        
        total_sku = len(df_analytics)
        total_items_physical = int(df_analytics['stock'].sum())
        total_asset_value = (df_analytics['stock'] * df_analytics['price']).sum()

        with col_kpi1:
            st.metric("Total Jenis Barang (SKU)", f"{total_sku} Item")
        with col_kpi2:
            st.metric("Total Fisik di Gudang", f"{total_items_physical} Pcs")
        with col_kpi3:
            st.metric("💰 Estimasi Valuasi Aset", f"Rp {total_asset_value:,.0f}".replace(',', '.'))

        st.divider()

        # --- 2. VISUALISASI GRAFIK (PLOTLY EXPRESS) ---
        col_chart1, col_chart2 = st.columns(2)

        with col_chart1:
            # Grafik 1: Bar Chart Horizontal (Agar teks nama barang tidak terpotong)
            df_stock = df_analytics.sort_values(by='stock', ascending=True)
            fig_stock = px.bar(
                df_stock, 
                x='stock', 
                y='item_name', 
                orientation='h',
                text='stock', # Memunculkan angka di dalam bar
                labels={'stock': 'Jumlah Stok', 'item_name': 'Nama Barang'},
                color='stock',
                color_continuous_scale='Reds' # Warna gradasi merah
            )
            fig_stock.update_layout(
                title="<b>Distribusi Ketersediaan Stok</b>",
                xaxis_title=None,
                yaxis_title=None,
                margin=dict(l=0, r=0, t=40, b=0),
                coloraxis_showscale=False # Menyembunyikan legenda warna agar bersih
            )
            st.plotly_chart(fig_stock, use_container_width=True)

        with col_chart2:
            # Grafik 2: Bar Chart Vertikal dengan angka di atas bar
            df_price = df_analytics.sort_values(by='price', ascending=False)
            fig_price = px.bar(
                df_price, 
                x='item_name', 
                y='price', 
                text='price',
                labels={'price': 'Harga (Rp)', 'item_name': 'Nama Barang'},
                color='price',
                color_continuous_scale='Greens' # Warna gradasi hijau
            )
            # Format angka menjadi rupiah (contoh: 100,000)
            fig_price.update_traces(texttemplate='Rp %{text:,.0f}', textposition='outside')
            fig_price.update_layout(
                title="<b>Peta Harga Barang (Rp)</b>",
                xaxis_title=None,
                yaxis_title=None,
                margin=dict(l=0, r=0, t=40, b=0),
                coloraxis_showscale=False
            )
            # Melebarkan batas atas Y agar angka tidak terpotong atap grafik
            fig_price.update_yaxes(range=[0, df_price['price'].max() * 1.2]) 
            
            st.plotly_chart(fig_price, use_container_width=True)

        st.divider()

        # --- 3. EARLY WARNING SYSTEM (Peringatan Stok) ---

        st.subheader(" Status Ketersediaan Barang")
        
        # Pecah logika filter menjadi dua: Habis (0) dan Menipis (1-4)
        out_of_stock_df = df_analytics[df_analytics['stock'] <= 0]
        low_stock_df = df_analytics[(df_analytics['stock'] > 0) & (df_analytics['stock'] < 5)]
        
        # 1. Tampilkan peringatan merah jika ada barang habis
        if not out_of_stock_df.empty:
            st.error("❌ **BARANG HABIS (OUT OF STOCK):** Barang berikut tidak bisa dijual lagi! Segera lakukan pengadaan barang.")
            st.dataframe(
                out_of_stock_df[['item_name', 'stock']], 
                hide_index=True, 
                use_container_width=True
            )

        # 2. Tampilkan peringatan kuning jika ada barang menipis
        if not low_stock_df.empty:
            st.warning("⚠️ **STOK MENIPIS (1-4 pcs):** Barang berikut hampir habis. Bersiap untuk restock!")
            st.dataframe(
                low_stock_df[['item_name', 'stock']], 
                hide_index=True, 
                use_container_width=True
            )

        # 3. Jika tidak ada yang habis dan tidak ada yang menipis (Semua >= 5)
        if out_of_stock_df.empty and low_stock_df.empty:
            st.success("✅ Seluruh stok barang dalam kondisi aman (minimal 5 pcs).")

    else:
        st.info("Gudang masih kosong. Tambahkan barang di tab Manajemen Stok untuk melihat analitik.")

# TAB 4: LIVE CS & HANDOFF
with tab4:
    st.subheader("🎧 Live Customer Service Control")
    st.markdown("Daftar pelanggan yang meminta bantuan Admin Manusia. Jika saklar 'Human Mode' aktif, AI akan berhenti membalas nomor tersebut.")
    
    # Cari nomor WA yang sedang dalam mode manusia
    # Gunakan .sort() agar antrean yang terbaru ada di atas (opsional tapi disarankan)
    human_mode_users = list(session_col.find({"is_human_mode": True}, {"_id": 0, "phone_number": 1, "last_message": 1, "updated_at": 1}))

    if human_mode_users:
        st.error(f" PERHATIAN: Ada {len(human_mode_users)} pelanggan yang menunggu balasan Admin!")
        
        # Tampilkan setiap user yang butuh bantuan dalam expander
        for user in human_mode_users:
            phone_num = user.get('phone_number')
            # Rapikan format nomor (menghilangkan @c.us jika ada)
            display_num = phone_num.split('@')[0] if phone_num else "Unknown"
            
            with st.expander(f"📱 Pelanggan: {display_num} | Waktu: {user.get('updated_at', 'Baru saja').strftime('%Y-%m-%d %H:%M:%S') if hasattr(user.get('updated_at'), 'strftime') else 'Baru saja'}"):
                st.write(f"**Alasan/Pesan Terakhir:** {user.get('last_message', 'Tidak ada data pesan')}")
                st.write("Silakan balas pesan pelanggan ini langsung melalui HP/WhatsApp Web Admin.")
                
                st.divider()
                # TOMBOL UNTUK MENGEMBALIKAN KE AI
                if st.button(f"✅ Selesai! Kembalikan {display_num} ke Bot AI", key=phone_num):
                    # Matikan saklar di database
                    session_col.update_one(
                        {"phone_number": phone_num},
                        {"$set": {"is_human_mode": False}}
                    )
                    st.success(f"✅ AI telah diaktifkan kembali untuk nomor {display_num}.")
                    st.rerun() # Refresh dashboard
    else:
        st.success("✅ Semua pelanggan sedang dilayani oleh AI dengan aman. Belum ada antrean untuk Admin.")