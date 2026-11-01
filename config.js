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

        if (res.ok && (json.success || json.data || json.qr_image || json.qr_string)) {
            const d = json.data || json;
            let qrImg = d.qr_image || d.qris_image_url || d.qr_image_url || d.image_url || d.qris_url || d.qr_url || d.qris_image;
            const qrStr = d.qr_string || d.qris_string || d.qr_content || d.qris_data;

            if (!qrImg && qrStr) {
                qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrStr)}`;
            }

            // Ambil ID transaksi asli dari PayinAja (cek semua kemungkinan nama field)
            const realTrxId = d.trx_id || d.transaction_id || d.payinaja_trx_id || d.id || d.reference_id || referenceId;

            if (qrImg) {
                return {
                    success: true,
                    payinaja_trx_id: String(realTrxId),
                    reference_id: String(referenceId),
                    total_amount: parseInt(d.total_amount || d.amount || payload.amount) || payload.amount,
                    qr_image: qrImg
                };
            }
        } else {
            console.warn("PayinAja menolak pembuatan QRIS:", json.message || json);
        }
    } catch (err) {
        console.warn("Gagal memanggil /api/payinaja:", err);
    }

    return {
        success: false,
        payinaja_trx_id: String(referenceId),
        reference_id: String(referenceId),
        total_amount: payload.amount,
        qr_image: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=DIGIPRINT-${referenceId}-${payload.amount}`
    };
}

// 3. Fungsi Cek Status Pembayaran Otomatis via Backend Vercel (Anti-Cache & Multi-Field)
async function cekStatusPayinAja(payinajaTrxId, referenceId = "") {
    if (!payinajaTrxId && !referenceId) return { isPaid: false, raw: null };
    try {
        const url = `/api/payinaja?action=status&trx_id=${encodeURIComponent(payinajaTrxId || "")}&ref_id=${encodeURIComponent(referenceId || "")}&_t=${Date.now()}`;
        const res = await fetch(url, {
            method: "GET",
            cache: "no-store"
        });
        if (!res.ok) return { isPaid: false, raw: null };

        const json = await res.json();
        const d = json.data || json.transaction || json;

        // Cek semua kemungkinan field status dari PayinAja
        const rawStatus = String(
            d?.status ||
            d?.transaction_status ||
            d?.payment_status ||
            d?.state ||
            json?.status ||
            ""
        ).toLowerCase().trim();

        const isPaid =
            ["paid", "success", "settlement", "settled", "completed", "complete", "berhasil", "lunas", "selesai", "1", "true"].includes(rawStatus) ||
            d?.is_paid === true ||
            Boolean(d?.paid_at);

        return { isPaid, statusText: rawStatus, raw: d };
    } catch (e) {
        return { isPaid: false, raw: null };
    }
}