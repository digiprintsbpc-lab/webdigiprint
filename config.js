// ==========================================
// config.js - Pusat Konfigurasi API Website
// ==========================================

// 1. Konfigurasi Supabase (Database)
const SUPABASE_URL = "https://hrioipatickknkldtenh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MZTcfjV0ZHaNWT2m9RLXpQ_cjCUHmOJ";

// Fungsi pembantu untuk memanggil REST API Supabase
async function fetchSupabase(table, method = "GET", body = null) {
    const options = {
        method: method,
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, options);
        if (!response.ok) {
            const errText = await response.text();
            console.warn(`Supabase HTTP ${response.status} (${table}):`, errText);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error(`Error Fetching Supabase (${table}):`, error);
        return null;
    }
}

// 2. Fungsi Membuat QRIS Resmi via Backend Vercel (/api/payinaja)
async function buatQrisPayinAja(amount, referenceId, customerName) {
    const payload = {
        amount: Math.max(1000, parseInt(amount) || 0),
        reference_id: String(referenceId),
        customer_name: String(customerName || "Pelanggan DIGIPRINT")
    };

    try {
        const res = await fetch("/api/payinaja?action=create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const json = await res.json();

        if (res.ok && (json.success || json.data)) {
            const d = json.data || json;
            let qrImg = d.qr_image || d.qris_image_url || d.qr_image_url || d.image_url || d.qris_url || d.qr_url || d.qris_image;
            const qrStr = d.qr_string || d.qris_string || d.qr_content || d.qris_data;

            if (!qrImg && qrStr) {
                qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrStr)}`;
            }

            if (qrImg) {
                return {
                    success: true,
                    payinaja_trx_id: d.payinaja_trx_id || d.trx_id || d.id || referenceId,
                    total_amount: d.total_amount || d.amount || payload.amount,
                    qr_image: qrImg
                };
            }
        } else {
            console.warn("PayinAja menolak pembuatan QRIS:", json.message || json);
        }
    } catch (err) {
        console.warn("Gagal memanggil /api/payinaja:", err);
    }

    // Fallback QRIS jika dijalankan lokal tanpa vercel dev
    return {
        success: false,
        payinaja_trx_id: referenceId,
        total_amount: payload.amount,
        qr_image: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=DIGIPRINT-${referenceId}-${payload.amount}`
    };
}

// 3. Fungsi Cek Status Pembayaran Otomatis via Backend Vercel
async function cekStatusPayinAja(payinajaTrxId) {
    if (!payinajaTrxId) return null;
    try {
        const res = await fetch(`/api/payinaja?action=status&trx_id=${encodeURIComponent(payinajaTrxId)}`, {
            method: "GET"
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.data || json;
    } catch (e) {
        return null;
    }
    // 4. Fungsi Hash PIN / Password dengan SHA-256 (Web Crypto API)
async function hashPinSHA256(plainText) {
    const text = String(plainText || "");
    if (window.crypto && window.crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    }
    return text;
}
}
