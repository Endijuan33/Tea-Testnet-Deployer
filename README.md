# Somnia-Testnet-deployer

# Automated Token Deployment and Distribution Tool

Alat CLI untuk deploy kontrak token ERC20 dan distribusi token/native asset di jaringan Somnia Testnet.

## Fitur Utama
- 🛠️ Deploy kontrak ERC20 custom dengan verifikasi otomatis
- 💸 Distribusi native token (STT) ke alamat acak dengan nilai random
- 🪙 Distribusi token ERC20 ke alamat acak
- 🔒 Manajemen wallet otomatis dengan daily transaction limit
- ⏳ Simulasi pola transaksi realistis dengan delay acak
- 🔍 Integrasi dengan explorer blockchain Somnia

## Prasyarat
- Node.js v18+
- npm v9+
- Hardhat (akan diinstal otomatis jika belum ada)
- Akun blockchain dengan saldo STT

## Instalasi
1. Clone repositori:
```bash
git clone https://github.com/Endijuan33/Somnia-Testnet-deployer.git
cd Somnia-Testnet-deployer
```

2. Instal dependensi:
```bash
npm install
```

3. copy file .env.example menjadi .env dan isi dengan konfigurasi yang diperlukan:
```bash
MAIN_PRIVATE_KEY=0xprivate_key_wallet_anda
RPC_URL=https://dream-rpc.somnia.network
CHAIN_ID=50312
EXPLORER_URL=https://shannon-explorer.somnia.network/
CONTRACT_ADDRESS=
```

## Konfigurasi
| Variabel           | Deskripsi                                      | Contoh Nilai                          |
|--------------------|------------------------------------------------|---------------------------------------|
| MAIN_PRIVATE_KEY   | Private key wallet utama                       | 0xabc123...                           |
| RPC_URL            | URL RPC jaringan Somnia                        | https://dream-rpc.somnia.network      |
| CHAIN_ID           | ID jaringan Somnia Testnet                     | 50312                                 |
| CONTRACT_ADDRESS   | Alamat kontrak (diisi otomatis setelah deploy) | 0x...                                 |
| EXPLORER_URL       | URL blockchain explorer                        | https://shannon-explorer.somnia.network |

## Penggunaan
Run Command:
```bash
npm run start
```

### Menu Utama
1. **Deploy Kontrak Baru**  
   - Membuat token ERC20 custom
   - Akan memandu melalui input:
     - Nama Token
     - Simbol Token
     - Jumlah Desimal
     - Total Supply
   - Otomatis verifikasi kontrak setelah deploy

2. **Kirim Native Token (STT)**  
   - Distribusi STT ke alamat acak
   - Nilai random: 0.001-0.0025 STT per transaksi
   - Batas harian: 5,000 transaksi/hari
   - Delay acak antara 15-60 detik antar transaksi

3. **Kirim Token ERC20**  
   - Distribusi token ke alamat acak
   - Input jumlah token per transaksi
   - Menggunakan kontrak yang sudah dideploy
   - Batas harian sama seperti native token

## Keamanan
- 🚫 Jangan pernah membagikan file `.env` atau `random_wallets.json`
- 🔐 Private key disimpan hanya di environment variable lokal
- ⚠️ Jangan tamak, gunakan dengan bijak tanpa menyalahi aturan - DWYOR!

## Catatan Penting
- Pastikan wallet utama memiliki saldo STT yang cukup
- Verifikasi kontrak memerlukan Hardhat - akan diinstal otomatis
- Transaksi gagal akan dilaporkan tanpa menghentikan proses

## License
MIT License

Untuk menjalankan skrip:

1. Pastikan semua dependensi terinstal
2. Isi file `.env` dengan konfigurasi yang benar
3. Jalankan perintah:
```bash
node main.js
```

Ikuti petunjuk menu interaktif yang muncul di CLI. Untuk operasi pertama, disarankan memulai dengan deploy kontrak terlebih dahulu sebelum melakukan distribusi token.

Perhatikan batas harian transaksi dan pastikan wallet utama memiliki saldo yang cukup untuk gas fee dan distribusi token.
