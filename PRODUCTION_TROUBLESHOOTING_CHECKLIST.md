# 🚀 Production Troubleshooting Checklist

Ikuti checklist ini untuk memverifikasi dan memperbaiki masalah Azure Functions di production.

## ✅ Langkah 1: Health Check Production

Jalankan script health check untuk memverifikasi status current:

```powershell
.\scripts\production-health-check.ps1
```

**Input yang diperlukan**: URL production Anda (contoh: https://your-app.azurestaticapps.net)

**Expected Results**:

- ✅ Frontend accessible (200 OK)
- ✅ /api/health endpoint working (200 OK)
- ⚠️ Other API endpoints might return 400/500 (normal jika env vars belum di-set)

## ✅ Langkah 2: Verifikasi Environment Variables

Cek apakah environment variables sudah di-set di Azure Portal:

### Via Azure Portal:

1. Buka Azure Portal → Static Web Apps
2. Pilih aplikasi Anda
3. Go to **Configuration** → **Application settings**
4. Pastikan ada settings berikut:

```
KEY_VAULT_URL=https://your-keyvault.vault.azure.net/
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
COSMOS_DB_CONNECTION_STRING=your-cosmos-connection
```

### Via Azure CLI:

```powershell
# Login jika belum
az login

# Ganti dengan nama resource group dan static web app Anda
$resourceGroup = "your-resource-group-name"
$staticWebAppName = "your-static-web-app-name"

# Cek environment variables yang sudah di-set
az staticwebapp appsettings list -n $staticWebAppName -g $resourceGroup
```

### Set Environment Variables (jika belum ada):

```powershell
# Set semua environment variables yang diperlukan
az staticwebapp appsettings set -n $staticWebAppName -g $resourceGroup --setting-names `
  KEY_VAULT_URL="https://your-keyvault.vault.azure.net/" `
  AZURE_OPENAI_ENDPOINT="https://your-openai.openai.azure.com/" `
  AZURE_OPENAI_API_KEY="your-api-key" `
  COSMOS_DB_CONNECTION_STRING="your-cosmos-connection"
```

## ✅ Langkah 3: Verifikasi Functions Deployment

Cek apakah Azure Functions sudah ter-deploy dengan benar:

```powershell
# Jalankan diagnostic script
.\scripts\azure-swa-diagnostic.ps1 -ResourceGroupName $resourceGroup -StaticWebAppName $staticWebAppName

# Atau cek manual
az staticwebapp functions list -n $staticWebAppName -g $resourceGroup
```

**Expected Results**: Harus ada 3 functions: health, get-secret, chat-completion

## ✅ Langkah 4: Test API Endpoints Setelah Environment Variables Di-Set

Setelah environment variables di-set, tunggu beberapa menit lalu test ulang:

```powershell
# Test ulang dengan health check script
.\scripts\production-health-check.ps1
```

**Expected Results After Env Vars Set**:

- ✅ /api/health → 200 OK
- ✅ /api/get-secret → 400/404 (normal tanpa valid secret name)
- ✅ /api/chat-completion → 400/401 (normal tanpa valid input)

## ✅ Langkah 5: Cek Logs Jika Masih Error

Jika masih ada error 500, cek logs:

### Via Azure Portal:

1. Azure Portal → Static Web Apps → Your App
2. Go to **Functions** tab
3. Cek status functions
4. Klik **Application Insights** untuk logs

### Via Azure CLI:

```powershell
# Get app insights connection string
$appInsights = az staticwebapp show -n $staticWebAppName -g $resourceGroup --query "buildProperties.appInsightsConnectionString" -o tsv

# Query recent errors
az monitor app-insights query --app $staticWebAppName --analytics-query "exceptions | where timestamp > ago(1h) | order by timestamp desc"
```

## 🔧 Jika Masih Bermasalah

### Option 1: Force Redeploy

```powershell
# Trigger redeploy via GitHub Actions
# Buat commit kosong dan push:
git commit --allow-empty -m "Force redeploy"
git push
```

### Option 2: Manual Rebuild

```powershell
# Rebuild functions locally dan commit
npm run clean:dist
npm run functions:build
git add api/
git commit -m "Rebuild functions"
git push
```

### Option 3: Check Workflow Status

1. Go to GitHub → Your Repository → Actions
2. Check latest workflow run
3. Look for any errors in build/deploy steps

## 📞 Escalation

Jika semua langkah di atas sudah dilakukan dan masih ada masalah:

1. **Capture Screenshots**: Error messages, Azure Portal status
2. **Collect Logs**: Application Insights, GitHub Actions logs
3. **Document Environment**: What's working vs what's not
4. **Test Local**: Confirm everything works locally

## 🎯 Success Criteria

Anda berhasil jika:

- ✅ Frontend bisa diakses
- ✅ /api/health returns 200 OK
- ✅ /api/get-secret returns proper error for invalid input (bukan 404/500)
- ✅ /api/chat-completion returns proper error for invalid input (bukan 404/500)
- ✅ No 404 errors pada API endpoints
- ✅ Environment variables ter-load dengan benar

---

**Next Steps After Success**: Test end-to-end functionality dengan real data untuk memastikan integrations (Key Vault, OpenAI, Cosmos DB) berjalan dengan baik.
