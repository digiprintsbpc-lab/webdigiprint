// File: api/payinaja.js
// Serverless Function Vercel untuk menjembatani Website DIGIPRINT dengan API PayinAja

export default async function handler(req, res) {
    // Izinkan akses dari domain website Anda
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Ambil API Key dari Environment Variable Vercel atau dari config fallback
    // PENTING: Pastikan menggunakan API Key "sk_live_..." dari menu Pengaturan Akun PayinAja
    const API_KEY = process.env.PAYINAJA_API_KEY || req.headers["x-api-key"] || "PAYINAJA-0JVX4YDB-VU905HXW-CGP2VSC4";
    const BASE_URL = "https://payinaja.com/api/v1";
    const action = req.query.action;

    try {
        // 1. BUAT QRIS BARU (POST /api/payinaja?action=create)
        if (req.method === "POST" && action === "create") {
            const { amount, reference_id, customer_name } = req.body || {};

            const payload = {
                amount: Math.max(1000, parseInt(amount) || 0),
                reference_id: String(reference_id || "INV-" + Date.now()),
                customer_name: String(customer_name || "Pelanggan DIGIPRINT")
            };

            // Coba Server 2 (/qris/create2) lalu Server 1 (/qris/create) sesuai dokumentasi PayinAja
            let response = await fetch(`${BASE_URL}/qris/create2`, {
                method: "POST",
                headers: {
                    "x-api-key": API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                response = await fetch(`${BASE_URL}/qris/create`, {
                    method: "POST",
                    headers: {
                        "x-api-key": API_KEY,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
            }

            const data = await response.json();
            return res.status(response.status).json(data);
        }

        // 2. CEK STATUS TRANSAKSI (GET /api/payinaja?action=status&trx_id=...)
        if (req.method === "GET" && action === "status") {
            const { trx_id } = req.query;
            if (!trx_id) {
                return res.status(400).json({ success: false, message: "Parameter trx_id wajib diisi" });
            }

            const response = await fetch(`${BASE_URL}/transaction/${encodeURIComponent(trx_id)}`, {
                method: "GET",
                headers: {
                    "x-api-key": API_KEY,
                    "Accept": "application/json"
                }
            });

            const data = await response.json();
            return res.status(response.status).json(data);
        }

        // 3. BATALKAN TRANSAKSI (POST /api/payinaja?action=cancel&trx_id=...)
        if (req.method === "POST" && action === "cancel") {
            const { trx_id } = req.query;
            const response = await fetch(`${BASE_URL}/transaction/${encodeURIComponent(trx_id)}/cancel`, {
                method: "POST",
                headers: {
                    "x-api-key": API_KEY,
                    "Accept": "application/json"
                }
            });

            const data = await response.json();
            return res.status(response.status).json(data);
        }

        return res.status(400).json({ success: false, message: "Parameter action tidak valid" });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Gagal menghubungi server PayinAja: " + error.message
        });
    }
}