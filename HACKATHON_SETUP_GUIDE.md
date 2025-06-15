# VirPal App - Hackathon Setup Guide 🚀

## 🎯 Quick Setup untuk Hackathon (elevAIte with Dicoding 2025)

File ini berisi panduan cepat untuk mengkonfigurasi hardcoded credentials untuk hackathon. **PENTING**: Ini hanya untuk demo hackathon, jangan digunakan di production!

## 🔒 GitHub Branch Protection - AMAN untuk Hackathon! ✅

### ✅ Rekomendasi AMAN untuk Penjurian (16-20 Juni)

Untuk hackathon dengan timeline ketat, setup **minimal tapi aman**:

**Quick Setup di GitHub:**

1. **Settings** → **Rules** → **Rulesets** → **New branch ruleset**
2. **Konfigurasi ini (AMAN untuk hackathon):**

   ```yaml
   Ruleset Name: hackathon-protection
   Target branches: main

   ✅ AKTIFKAN (Untuk keamanan):
     - Block force pushes # Mencegah kehilangan code
     - Restrict deletions # Melindungi branch utama

   ❌ SKIP (Untuk development speed):
     - Require status checks # Skip untuk speed
     - Require signed commits # Skip untuk kemudahan
     - Linear history # Skip untuk fleksibilitas
     - Pull request requirement # Optional (bisa di-skip)
   ```

3. **Save** → **Done!** 🎉

### 🚀 Mengapa Setup Ini AMAN?

- ✅ **Code terlindungi** dari force push yang merusak
- ✅ **Main branch tidak bisa dihapus** secara tidak sengaja
- ✅ **Tim masih bisa develop dengan cepat** tanpa blocking checks
- ✅ **Perfect untuk timeline hackathon** yang ketat (tinggal 1 hari!)

### Post-Hackathon (Setelah 20 Juni)

Setelah penjurian selesai, upgrade ke full protection dengan semua checks.

## 📋 Daftar Credentials yang Dibutuhkan

Untuk menjalankan VirPal App dalam mode hackathon, Anda perlu mengisi credentials berikut di file `src/config/credentials.ts`:

### 1. Azure OpenAI Service

```typescript
openAI: {
  endpoint: "https://your-openai-resource.openai.azure.com/",
  apiKey: "YOUR_AZURE_OPENAI_API_KEY_HERE", // ← Replace dengan API key Anda
  deploymentName: "gpt-4o-mini",
  apiVersion: "2024-10-01-preview"
},
```

**Cara mendapatkan:**

- Buka Azure Portal → Azure OpenAI Service
- Pilih resource Anda → Keys and Endpoint
- Copy API Key dan Endpoint

### 2. Azure Cosmos DB

```typescript
cosmosDB: {
  endpoint: "https://your-cosmos-account.documents.azure.com:443/",
  key: "YOUR_COSMOS_DB_PRIMARY_KEY_HERE", // ← Replace dengan primary key Anda
  database: "virpal-db",
  container: "conversations"
},
```

**Cara mendapatkan:**

- Buka Azure Portal → Cosmos DB Account
- Pilih account Anda → Keys
- Copy Primary Key dan URI

### 3. Azure Speech Service

```typescript
speechService: {
  key: "YOUR_SPEECH_SERVICE_KEY_HERE", // ← Replace dengan subscription key Anda
  region: "southeastasia",
  endpoint: "https://southeastasia.tts.speech.microsoft.com/"
},
```

**Cara mendapatkan:**

- Buka Azure Portal → Speech Services
- Pilih resource Anda → Keys and Endpoint
- Copy Subscription Key

### 4. Azure Entra External ID (sudah dikonfigurasi)

```typescript
entraID: {
  clientId: "9ae4699e-0823-453e-b0f7-b614491a80a2", // ✅ Sudah dikonfigurasi
  clientSecret: "YOUR_CLIENT_SECRET_HERE", // ← Replace jika perlu
  tenantId: "db0374b9-bb6f-4410-ad04-db7fe70f4d7b", // ✅ Sudah dikonfigurasi
  authority: "https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0" // ✅ Sudah dikonfigurasi
},
```

### 5. JWT Secret (untuk hackathon)

```typescript
jwt: {
  secret: "YOUR_JWT_SECRET_FOR_HACKATHON_DEMO_ONLY", // ← Replace dengan secret yang kuat
  issuer: "https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0", // ✅ Sudah dikonfigurasi
  audience: "9ae4699e-0823-453e-b0f7-b614491a80a2" // ✅ Sudah dikonfigurasi
}
```

## 🔐 Mengenai JWT Secret - Penjelasan Lengkap

### Apa itu JWT Secret?

JWT Secret adalah kunci rahasia yang digunakan untuk:

1. **Menandatangani JWT tokens** yang dibuat oleh aplikasi
2. **Memverifikasi autentisitas** token yang diterima
3. **Memastikan keamanan** komunikasi antara frontend dan backend

### 🚀 Untuk Hackathon - Generate JWT Secret

**Option 1: Generate Random Secret (Recommended untuk Hackathon)**

Buka terminal dan jalankan:

```bash
# Option 1: Menggunakan Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Option 2: Menggunakan PowerShell (Windows)
[System.Web.Security.Membership]::GeneratePassword(64, 0)

# Option 3: Online Generator (hati-hati, jangan untuk production)
# https://generate-secret.vercel.app/64
```

**Output akan seperti ini:**

```
a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6
```

Copy hasil tersebut dan paste ke `credentials.ts`:

```typescript
jwt: {
  secret: "a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6", // ← Secret yang baru di-generate
  issuer: "https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0",
  audience: "9ae4699e-0823-453e-b0f7-b614491a80a2"
}
```

### 🔒 Kenapa JWT Secret Penting?

1. **Security**: Tanpa secret yang benar, token bisa dipalsukan
2. **Authentication**: Memastikan user yang login benar-benar terautentikasi
3. **Authorization**: Mengontrol akses ke API endpoints

### 🎯 Untuk Hackathon - Quick & Secure

**Step-by-step:**

1. **Generate secret baru:**

   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Update di credentials.ts:**

   ```typescript
   jwt: {
     secret: "HASIL_GENERATE_DARI_STEP_1", // ← Replace ini
     issuer: "https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0", // ✅ Sudah benar
     audience: "9ae4699e-0823-453e-b0f7-b614491a80a2" // ✅ Sudah benar
   }
   ```

3. **Verifikasi dengan build:**
   ```bash
   npm run functions:build
   ```

### ⚠️ Catatan Keamanan

- **JANGAN** gunakan JWT secret yang predictable seperti "password123"
- **JANGAN** share JWT secret di public repository
- **JANGAN** gunakan JWT secret yang sama di production dan development
- **Untuk hackathon**: Secret bisa disimpan di hardcoded credentials
- **Untuk production**: HARUS menggunakan Azure Key Vault atau environment variables

### 🧪 Test JWT Secret

Setelah mengupdate JWT secret, test dengan:

```bash
# Test local functions
npm run watch

# Di terminal lain, test authentication
curl -X POST http://localhost:7071/api/chat-completion \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"userInput": "Hello"}'
```

## 🔧 Langkah-langkah Setup

### 1. Update Credentials

1. Buka file `src/config/credentials.ts`
2. Replace semua value yang mengandung `YOUR_*_HERE` dengan credentials Anda
3. Pastikan tidak ada yang masih berisi placeholder

### 2. Verifikasi Konfigurasi

Jalankan validation:

```bash
npm run functions:build
```

Jika ada error "Invalid credentials", berarti masih ada placeholder yang belum diganti.

### 3. Test Local Development

```bash
# Terminal 1: Start Azure Functions
npm run watch

# Terminal 2: Start Frontend (terminal baru)
npm run dev
```

### 4. Deploy ke Azure Static Web Apps

```bash
# Build semua
npm run build

# Deploy menggunakan AZD
azd up
```

## 🚨 Keamanan untuk Hackathon

### Mode Hackathon

- File `src/config/credentials.ts` mengandung hardcoded credentials
- Mode hackathon diaktifkan dengan `isHackathonMode = true`
- JANGAN commit file ini ke public repository!

### Setelah Hackathon

1. Set `isHackathonMode = false` di `src/config/credentials.ts`
2. Migrate credentials ke Azure Key Vault
3. Update functions untuk menggunakan Managed Identity
4. Delete hardcoded credentials

## 📁 File Structure untuk Hackathon

```
src/
├── config/
│   ├── credentials.ts          ← 🔑 Hardcoded credentials (hackathon only)
│   ├── environment.ts          ← ✅ Updated untuk hackathon mode
│   └── msalConfig.ts          ← ✅ MSAL config (works)
├── functions/
│   ├── credentialHelper.ts    ← 🔧 Helper untuk load credentials
│   ├── chat-completion.ts     ← ✅ Updated untuk hackathon mode
│   └── jwtValidationService.ts ← ✅ Updated untuk hackathon mode
```

## 🔍 Troubleshooting

### Error: "Invalid credentials detected"

- Periksa file `src/config/credentials.ts`
- Pastikan semua `YOUR_*_HERE` sudah diganti dengan values yang benar

### Error: "Cannot connect to Azure services"

- Periksa API keys dan endpoints sudah benar
- Test credentials di Azure Portal

### CORS Error di Production

- Azure Static Web Apps otomatis handle CORS untuk managed functions
- Pastikan `staticwebapp.config.json` sudah benar

### Functions tidak bisa akses credentials

- Pastikan `src/functions/credentialHelper.ts` di-import dengan benar
- Periksa console logs untuk validation errors

## 📞 Support

Jika ada masalah dengan setup:

1. Cek console logs di browser dan function logs
2. Pastikan semua Azure services sudah active
3. Verify credentials di Azure Portal

## 📝 Checklist Deploy

- [ ] ✅ MSAL Authentication working
- [ ] 🔑 Azure OpenAI credentials updated
- [ ] 🔑 Cosmos DB credentials updated
- [ ] 🔑 Speech Service credentials updated
- [ ] 🔑 JWT secret updated
- [ ] 🧪 Local testing passed
- [ ] 🚀 Ready untuk deploy ke Azure SWA

---

**🎯 Hackathon Submission: elevAIte with Dicoding 2025**
**🏆 Theme: Mendukung SDG Indonesia dengan AI (SDG 3: Kesehatan Mental)**
**👨‍💻 Developer: Achmad Reihan Alfaiz**
