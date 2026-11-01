// File: api/payinaja.js
export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const API_KEY = process.env.PAYINAJA_API_KEY || req.headers["x-api-key"];
    const BASE_URL = "https://payinaja.com/api/v1";
    const action = req.query.action;

    if (!API_KEY) {
        return res.status(500).json({
            success: false,
            message: "PAYINAJA_API_KEY belum diset di Environment Variables Vercel."
        });
    }

    try {
        const bodyData = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

        // 1. BUAT QRIS BARU (POST /api/payinaja?action=create)
        if (req.method === "POST" && action === "create") {
            const { amount, reference_id, customer_name } = bodyData;

            const payload = {
                amount: Math.max(1000, parseInt(amount, 10) || 0),
                reference_id: String(reference_id || "INV-" + Date.now()),
                customer_name: String(customer_name || "Pelanggan DIGIPRINT")
            };

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