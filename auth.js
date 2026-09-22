import { ShopeeSDK, ShopeeRegion } from "@congminh1254/shopee-sdk";

export default async function handler(req, res) {
  // 1. Masukkan kembali Custom Token Storage Google Sheets Anda di sini
  // (Pastikan URL di bawah adalah URL Apps Script Anda yang berakhiran /exec)
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRCqpdLRrHa90lRa2Ib9fSnqT0oe3EkeH7XHTiNLm6TF9Y-SNqFru4wYawmwMDJmGb/exec";
  
  const googleSheetsStorage = {
    async getToken(shopId) {
      try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=get`);
        return await response.json();
      } catch (e) { return null; }
    },
    async saveToken(shopId, tokenData) {
      await fetch(`${APPS_SCRIPT_URL}?action=save`, {
        method: 'POST',
        body: JSON.stringify(tokenData),
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };

  try {
    const sdk = new ShopeeSDK({
      partner_id: Number(process.env.SHOPEE_PARTNER_ID),
      partner_key: process.env.SHOPEE_PARTNER_KEY,
      region: ShopeeRegion.GLOBAL,
      shop_id: Number(process.env.SHOPEE_SHOP_ID),
      storage: googleSheetsStorage 
    });

    // 2. URL Vercel ini sendiri, digunakan sebagai tujuan redirect setelah login Shopee
    // Ganti dengan URL Vercel utama Anda
    const redirectUrl = `https://shopee-middleware-erp.vercel.app/api/auth`;

    // 3. Menangkap kode otorisasi (auth_code) yang dilempar Shopee
    const authCode = req.query.code;

    // Skenario A: Jika belum ada kode, berikan URL untuk diklik pengguna
    if (!authCode) {
      const authUrl = sdk.getAuthorizationUrl(redirectUrl);
      return res.status(200).send(`
        <html><body>
          <h2>Menghubungkan Toko ke Sistem ERP</h2>
          <p>Klik tautan di bawah ini untuk mengizinkan aplikasi membaca data toko Anda.</p>
          <a href="${authUrl}" style="padding:10px 20px; background:orange; color:white; text-decoration:none; border-radius:5px;">
            Otorisasi Toko Shopee
          </a>
        </body></html>
      `);
    }

    // Skenario B: Jika kode sudah ada (berhasil diarahkan kembali dari Shopee)
    // TUKARKAN kode tersebut dengan token, SDK akan OTOMATIS menyimpannya ke storage (Google Sheets)
    await sdk.authenticateWithCode(authCode);

    return res.status(200).send(`
      <html><body>
        <h2 style="color:green;">Berhasil!</h2>
        <p>Token berhasil didapatkan dan telah dikirim ke Google Sheets (DB_Token). Anda bisa menutup halaman ini.</p>
      </body></html>
    `);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}