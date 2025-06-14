# VirPal - Submission Information

**elevAIte with Dicoding Developer Challenge 2025**

---

## 📋 Form Submission Details

### **App ID**

```
[Kosong/Optional]
```

_Catatan: Tidak diperlukan karena VirPal adalah aplikasi web, bukan mobile app_

### **Nama Aplikasi**

```
VirPal - AI Mental Health Assistant
```

### **Link Aplikasi**

```
https://ashy-coast-0aeebe10f.6.azurestaticapps.net/
```

**Status**: ✅ **DEPLOYED & LIVE** - Azure Static Web Apps

**Backup Options:**

1. **GitHub Repository**: `https://github.com/[username]/virpal-app`
2. **Google Drive**: `https://drive.google.com/[folder-id]`

### **Komentar (Project Brief)**

```
Project Brief VirPal - AI Mental Health Assistant dapat diakses melalui link berikut:

📄 **Project Brief Google Drive**: https://docs.google.com/document/d/11ecfO5HJYq6PCnwGbNV2s9m6srNg6HnvRKA5Qwbungg/edit?usp=sharing
🔗 **GitHub Documentation**: Repository dengan dokumentasi teknis lengkap

Dokumen telah dikonfigurasi dengan akses public untuk memudahkan juri dalam melakukan evaluasi.

Project Brief berisi informasi lengkap tentang:
- Problem statement kesehatan mental dan dampak judi online di Indonesia
- Solusi teknologi AI menggunakan Microsoft Azure
- Fitur utama dan implementasi teknis
- Roadmap pengembangan dan kontribusi terhadap SDG 3

Tim: VirPal Development Team
Email: reihan3000@gmail.com
Tema: Kesehatan Mental dan Dampak Judi Online (SDG 3)
```

---

## 🚀 Langkah Persiapan Submission

### **1. Persiapan Project Brief untuk Google Drive**

Untuk memastikan project brief dapat diakses oleh juri:

1. **Upload ke Google Drive**:

   - File: `PROJECT_BRIEF_ELEVATE_HACKATHON.md`
   - Atau convert ke Google Docs untuk akses yang lebih mudah

2. **Set Permissions**:

   - Klik "Share" pada file/folder
   - Pilih "Anyone with the link can view"
   - Copy link yang dihasilkan

3. **Verifikasi Akses**:
   - Test link di incognito browser
   - Pastikan dapat dibuka tanpa login

### **2. Deployment Options**

**Option A: Azure Static Web Apps (Recommended)**

```bash
# Deploy to Azure Static Web Apps
az staticwebapp create \
  --name virpal-app \
  --resource-group rg-virpal \
  --source https://github.com/[username]/virpal-app \
  --location "East Asia" \
  --branch main \
  --app-location "/" \
  --api-location "api" \
  --output-location "dist-frontend"
```

**Option B: Vercel/Netlify (Alternative)**

```bash
# Build for static deployment
npm run build:frontend
# Upload dist-frontend folder ke platform pilihan
```

**Option C: Local Demo + Video**

```bash
# Buat video demo aplikasi
# Upload ke YouTube/Google Drive
# Sertakan link video dalam submission
```

### **3. Repository Preparation**

Pastikan repository GitHub sudah siap:

```bash
# Pastikan semua file sudah committed
git add .
git commit -m "Final submission for elevAIte Hackathon 2025"
git push origin main

# Set repository visibility ke public (jika diperlukan)
# Tambahkan README.md yang komprehensif
# Pastikan documentation lengkap di folder docs/
```

---

## 📝 Template Isian Form Submission

**Copy-paste template ini saat mengisi form:**

### **App ID**:

```
[Kosong]
```

### **Nama Aplikasi**:

```
VirPal - AI Mental Health Assistant
```

### **Link Aplikasi**:

```
https://ashy-coast-0aeebe10f.6.azurestaticapps.net/
```

### **Komentar**:

```
Project Brief VirPal - AI Mental Health Assistant: https://docs.google.com/document/d/11ecfO5HJYq6PCnwGbNV2s9m6srNg6HnvRKA5Qwbungg/edit?usp=sharing

VirPal adalah AI Mental Health Assistant yang dikembangkan untuk mendukung SDG 3 (Good Health and Well-being) dengan fokus pada kesehatan mental dan pencegahan dampak judi online.

🌐 **Live Application**: https://ashy-coast-0aeebe10f.6.azurestaticapps.net/
📚 **Documentation**: GitHub repository dengan panduan lengkap

Aplikasi menggunakan teknologi Microsoft Azure termasuk OpenAI Service, Speech Service, dan Azure Functions. Project Brief berisi analisis lengkap problem statement, solusi teknologi, fitur utama, dan roadmap pengembangan.

Tim: VirPal Development Team | Email: reihan3000@gmail.com
Tema: Kesehatan Mental dan Dampak Judi Online
```

---

## 🔍 Checklist Pre-Submission

- [ ] Project Brief sudah lengkap dan komprehensif
- [ ] Google Drive link sudah di-set dengan akses public
- [ ] Aplikasi sudah di-deploy atau demo video sudah siap
- [ ] Repository GitHub sudah public dan dokumentasi lengkap
- [ ] All Azure services sudah dikonfigurasi dengan benar
- [ ] Testing aplikasi sudah dilakukan secara menyeluruh
- [ ] Contact information sudah benar dan dapat dihubungi

---

## 📞 Support Contact

**Developer**: Achmad Reihan Alfaiz
**Email**: reihan3000@gmail.com
**Project**: VirPal - AI Mental Health Assistant
**Hackathon**: elevAIte with Dicoding 2025
**Submission Date**: June 13, 2025

---

## ⏰ **Update Opportunity Window**

**Current Status**: Submission completed ✅
**Update Window**: **14-15 Juni 2025** (2 hari sebelum penjurian)
**Penjurian Period**: 16-20 Juni 2025

### **What Can Be Updated:**

- Bug fixes dan performance optimization
- UI/UX improvements untuk better user experience
- Feature enhancements (mood tracking, better responses)
- Mobile responsiveness dan accessibility
- Error handling dan stability improvements

### **Critical Requirements During Judging:**

- **Azure services harus tetap aktif** selama 16-20 Juni 2025
- **Live application** tetap dapat diakses di deployment URL
- **Project brief** tetap available dengan akses public
- **All integrations** (OpenAI, Speech Service, Key Vault) harus functional

### **Update Strategy Recommendations:**

1. **14 Juni**: Focus on bug fixes dan performance
2. **15 Juni**: Final testing dan polish
3. **16-20 Juni**: **NO CHANGES** - monitoring only
