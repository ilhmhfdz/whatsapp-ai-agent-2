import streamlit as st
import pandas as pd
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import certifi
import PyPDF2
import plotly.express as px
from datetime import datetime, timedelta

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
    db = client['whatsapp_bot_2'] 
    collection = db['agent_config']
    inventory_col = db['inventory'] 
    session_col = db['sessions'] 
except Exception as e:
    st.error(f"❌ Gagal terhubung ke MongoDB: {e}")
    st.stop()

# --- SIDEBAR ---
with st.sidebar:
    st.markdown(" **Live Demo**")
    st.link_button("Test Bot di WhatsApp (klik disini)", "https://wa.me/6285121571837", type="primary", use_container_width=True)
    st.header("⚙️ Status Sistem")
    st.success("MongoDB: Terhubung")
    st.info("Model: GPT-4o-mini (Tools Enabled)")

# --- MAIN LAYOUT ---
st.title("Control Panel AI Agent")
st.markdown("Sistem Manajemen Order Cerdas. AI dapat membaca dan memotong stok secara otomatis.")
st.divider()

current_config = collection.find_one({"type": "system_prompt"})
default_prompt = current_config["prompt"] if current_config else "Kamu adalah Customer Service toko..."
current_kb = current_config.get("knowledge_base", "") if current_config else ""

tab1, tab2, tab3, tab4 = st.tabs(["Manajemen Stok", "Konfigurasi Prompt", "Insight & Analitik Toko", "🎧 Live CS & Handoff"])

# TAB 1: MANAJEMEN STOK
with tab1:
    st.subheader("Gudang & Inventaris Toko (Interactive Mode)")
    st.markdown("Silakan klik langsung pada sel tabel di bawah untuk mengubah **Nama**, **Stok**, atau **Harga**.")
    
    items = list(inventory_col.find({}, {"_id": 0}))
    
    if items:
        df = pd.DataFrame(items)
        df = df[['item_name', 'stock', 'price']]
    else:
        df = pd.DataFrame(columns=['item_name', 'stock', 'price'])
        
    df.columns = ['Nama Barang', 'Stok Tersedia', 'Harga (Rp)']

    edited_df = st.data_editor(
        df,
        use_container_width=True,
        num_rows="dynamic",
        hide_index=True,
        height=300
    )

    col_btn1, col_btn2, col_space = st.columns([2, 2, 4])
    
    with col_btn1:
        if st.button("Simpan Perubahan Tabel", type="primary", use_container_width=True):
            try:
                inventory_col.delete_many({})
                if not edited_df.empty:
                    records = edited_df.rename(columns={
                        'Nama Barang': 'item_name',
                        'Stok Tersedia': 'stock',
                        'Harga (Rp)': 'price'
                    }).to_dict('records')
                    inventory_col.insert_many(records)
                st.success("✅ Database Gudang berhasil diperbarui!")
                st.rerun()
            except Exception as e:
                st.error(f"❌ Gagal menyimpan perubahan: {e}")

    with col_btn2:
        if st.button("⚠️ Kosongkan Semua", use_container_width=True):
            inventory_col.delete_many({})
            st.rerun()

# TAB 2: KONFIGURASI PROMPT
with tab2:
    st.subheader("Instruksi Utama (System Prompt)")
    with st.form("prompt_form"):
        new_prompt = st.text_area("Tentukan persona bot:", value=default_prompt, height=200)
        uploaded_file = st.file_uploader("Upload PDF Knowledge Base", type=["pdf"])
        submit_prompt = st.form_submit_button(label="💾 Simpan Konfigurasi", use_container_width=True)

        if submit_prompt:
            extracted_text = current_kb 
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
            st.rerun()

    st.markdown("---")
    st.subheader("Manajemen Memori Knowledge Base")
    if current_kb and current_kb.strip() != "":
        st.warning("⚠️ Saat ini ada Knowledge Base yang tersimpan.")
        if st.button("Hapus Knowledge Base dari Otak Bot", type="primary"):
            collection.update_one({"type": "system_prompt"}, {"$set": {"knowledge_base": ""}})
            st.success("✅ Memori berhasil dibersihkan!")
            st.rerun()
    else:
        st.info("✅ Memori aman. Tidak ada Knowledge Base yang tersimpan.")

# TAB 3: INSIGHT & ANALITIK
with tab3:
    st.subheader("Insight & Analitik Toko")
    items_analytics = list(inventory_col.find({}, {"_id": 0}))

    if items_analytics:
        df_analytics = pd.DataFrame(items_analytics)
        df_analytics['stock'] = pd.to_numeric(df_analytics['stock'], errors='coerce').fillna(0)
        df_analytics['price'] = pd.to_numeric(df_analytics['price'], errors='coerce').fillna(0)

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
        col_chart1, col_chart2 = st.columns(2)

        with col_chart1:
            df_stock = df_analytics.sort_values(by='stock', ascending=True)
            fig_stock = px.bar(df_stock, x='stock', y='item_name', orientation='h', text='stock', color='stock', color_continuous_scale='Reds')
            fig_stock.update_layout(title="<b>Distribusi Ketersediaan Stok</b>", coloraxis_showscale=False)
            st.plotly_chart(fig_stock, use_container_width=True)

        with col_chart2:
            df_price = df_analytics.sort_values(by='price', ascending=False)
            fig_price = px.bar(df_price, x='item_name', y='price', text='price', color='price', color_continuous_scale='Greens')
            fig_price.update_traces(texttemplate='Rp %{text:,.0f}', textposition='outside')
            fig_price.update_layout(title="<b>Peta Harga Barang (Rp)</b>", coloraxis_showscale=False)
            st.plotly_chart(fig_price, use_container_width=True)

        st.divider()
        st.subheader("Status Ketersediaan Barang")
        out_of_stock_df = df_analytics[df_analytics['stock'] <= 0]
        low_stock_df = df_analytics[(df_analytics['stock'] > 0) & (df_analytics['stock'] < 5)]
        
        if not out_of_stock_df.empty:
            st.error("❌ **BARANG HABIS:** Segera lakukan pengadaan.")
            st.dataframe(out_of_stock_df[['item_name', 'stock']], hide_index=True, use_container_width=True)
        if not low_stock_df.empty:
            st.warning("⚠️ **STOK MENIPIS:** Bersiap untuk restock.")
            st.dataframe(low_stock_df[['item_name', 'stock']], hide_index=True, use_container_width=True)
        if out_of_stock_df.empty and low_stock_df.empty:
            st.success("✅ Seluruh stok barang dalam kondisi aman.")
    else:
        st.info("Gudang masih kosong.")

# TAB 4: LIVE CS & HANDOFF
with tab4:
    st.subheader("Live Customer Service Control")
    st.markdown("Kelola pelanggan yang membutuhkan bantuan admin.")
    
    # Menarik field display_number dari database
    human_mode_users = list(session_col.find({"is_human_mode": True}, {"_id": 0, "phone_number": 1, "last_message": 1, "updated_at": 1, "display_number": 1}))

    if human_mode_users:
        st.error(f"🚨 PERHATIAN: Ada {len(human_mode_users)} pelanggan menunggu Admin!")
        
        for user in human_mode_users:
            phone_num = user.get('phone_number') # ID mesin untuk dikirim balik ke database
            
            # Prioritaskan mengambil nomor asli (display_number). Jika tidak ada, pakai fallback.
            display_num = user.get('display_number')
            if not display_num:
                display_num = phone_num.split('@')[0] if phone_num else "Unknown"
            
            # Logika konversi waktu ke WIB
            raw_time = user.get('updated_at')
            if isinstance(raw_time, datetime):
                wib_time = raw_time + timedelta(hours=7)
                time_display = wib_time.strftime('%d/%m/%Y %H:%M:%S WIB')
            else:
                time_display = "Baru saja"
            
            with st.expander(f"📱 Pelanggan: {display_num} | {time_display}"):
                st.write(f"**Pesan Terakhir:** {user.get('last_message', 'Tidak ada data')}")
                st.divider()
                if st.button(f"✅ Selesaikan & Aktifkan AI", key=phone_num):
                    session_col.update_one({"phone_number": phone_num}, {"$set": {"is_human_mode": False}})
                    st.success(f"✅ AI kembali aktif untuk {display_num}")
                    st.rerun()
    else:
        st.success("✅ Semua pelanggan sedang dilayani oleh AI.")