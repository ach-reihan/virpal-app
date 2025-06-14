# Debug Production API - VirPal App
# Script untuk mendiagnosa masalah akses layanan Azure di production

Write-Host "🔍 VirPal App - Production API Debugging" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$apiBaseUrl = "https://ashy-coast-0aeebe10f.6.azurestaticapps.net"

# Test 1: Health Check (tanpa authentication)
Write-Host "`n1️⃣ Testing Health Endpoint (No Auth)" -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$apiBaseUrl/api/health" -Method GET -TimeoutSec 10
    Write-Host "✅ Health check successful" -ForegroundColor Green
    Write-Host "Response: $($healthResponse | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
    }
}

# Test 2: API endpoint tanpa Authorization header
Write-Host "`n2️⃣ Testing API without Authorization" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$apiBaseUrl/api/get-secret?name=azure-cosmos-db-key" -Method GET -TimeoutSec 10
    Write-Host "❌ Unexpected success - should require authentication" -ForegroundColor Red
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "✅ Expected failure: $statusCode" -ForegroundColor Green
    if ($statusCode -eq 401) {
        Write-Host "Authentication correctly required" -ForegroundColor Green
    }
}

# Test 3: Check environment variables and configuration
Write-Host "`n3️⃣ Checking Local Configuration" -ForegroundColor Yellow
$localSettings = Get-Content "local.settings.json" | ConvertFrom-Json
$keyVaultUrl = $localSettings.Values.KEY_VAULT_URL
Write-Host "Local Key Vault URL: $keyVaultUrl" -ForegroundColor Gray

# Test 4: Test dengan sample JWT token (untuk debugging format)
Write-Host "`n4️⃣ Testing JWT Token Format" -ForegroundColor Yellow
$sampleToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IkNOdjBPSTNSd3FsSEZFVm5hb01Bc2hDSDJYRSJ9.eyJhdWQiOiI5YWU0Njk5ZS0wODIzLTQ1M2UtYjBmNy1iNjE0NDkxYTgwYTIiLCJpc3MiOiJodHRwczovL2RiMDM3NGI5LWJiNmYtNDQxMC1hZDA0LWRiN2ZlNzBmNGQ3Yi5jaWFtbG9naW4uY29tL2RiMDM3NGI5LWJiNmYtNDQxMC1hZDA0LWRiN2ZlNzBmNGQ3Yi92Mi4wIiwiaWF0IjoxNzQ5OTA3NTMxLCJuYmYiOjE3NDk5MDc1MzEsImV4cCI6MTc0OTkxMjAwOSwiYWlvIjoiQVZRQXEvOFpBQUFBSHRyVzZWSWpDUzM0TWJDamQycEQwQ2FiM2wxUlJPRXVYRGZUQUJZc0k0Ry9DR1puK3lseDhQSlZlZllrY0ZkekRJd1V3VTlLMnQvQnV0Z3V0U3M2V01jMXJWajNXWVpTR0g0RE1Lck5VcnM9IiwiYXpwIjoiZjU0NjQ4MmYtYTM2NS00MTM2LWE5MTctMDdjYWMwMjk1MDFmIiwiYXpwYWNyIjoiMCIsIm5hbWUiOiJSZWloYW4iLCJvaWQiOiJkYjU1NDdiMS1iNTE1LTRmZmMtYmEwMS1jMGI5NzQ1M2RjZDIiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJyZWloYW4zMDAwQGdtYWlsLmNvbSIsInJoIjoiMS5BY0VBdVhRRDIyLTdFRVN0Qk50XzV3OU5lNTVwNUpvakNENUZzUGUyRkVrYWdLTEJBUERCQUEuIiwic2NwIjoiVmlycGFsLlJlYWRXcml0ZSIsInNpZCI6IjAwNWRiODQ5LTFkMjctOGUwNC05NWI4LTk5ZDUzMjQ2Mzk3ZCIsInN1YiI6ImpES0hXMnRfNndhNmphM2pFQklOcW9LamxQYktJUi1lbmtyYi1NYU1nRDAiLCJ0aWQiOiJkYjAzNzRiOS1iYjZmLTQ0MTAtYWQwNC1kYjdmZTcwZjRkN2IiLCJ1dGkiOiIyTU8wZWg1bVdFZUUyWllPcFN3QUFBIiwidmVyIjoiMi4wIiwieG1zX2Z0ZCI6ImVuWTVzTWF5NG1WZ0ZpazdDdEVWMF9TWUNydVFjbWtTUFFZRG9QVDMyQWdCWVhOcFlYTnZkWFJvWldGemRDMWtjMjF6In0.CzJAJTcleTyK7XjEg1yUR9A9rljODIGdG8YySagct5cQnH9brOMzADwzWdj5VzEJ3vlOTmXfapr6RGvoUu1RzIvm3kOSTC1aeQeVBQGWKN6Vl0o3ze-wsxsp_dhzoWKoBxtprzu8yiu-DwD0kMhTZJgL5ZYGbY2hgUW0NN1BVub6VvNzqGOFModL8ax2FhJ6i8S2hjDuGNzVn79NhzOKCPqpKBV8uGpULdV0HuVZRMHUT4O83Tvr5ZcQC4hnTsioPQirK0HIKa28JtLCJvtYfWtJG_n_cUEmKwVbOvZmdDnOYnT26uxN-M992QameygT7ncWsU1rUj00NnZvLuv6iQ"

# Decode JWT header untuk melihat kid
$parts = $sampleToken.Split('.')
if ($parts.Length -ge 2) {
    $header = $parts[0]
    # Add padding if needed
    $padding = 4 - ($header.Length % 4)
    if ($padding -ne 4) {
        $header += "=" * $padding
    }

    try {
        $headerBytes = [System.Convert]::FromBase64String($header)
        $headerJson = [System.Text.Encoding]::UTF8.GetString($headerBytes)
        $headerObj = $headerJson | ConvertFrom-Json

        Write-Host "JWT Header decoded successfully:" -ForegroundColor Green
        Write-Host "- typ: $($headerObj.typ)" -ForegroundColor Gray
        Write-Host "- alg: $($headerObj.alg)" -ForegroundColor Gray
        Write-Host "- kid: $($headerObj.kid)" -ForegroundColor Gray

        # Check payload exp
        $payload = $parts[1]
        $padding = 4 - ($payload.Length % 4)
        if ($padding -ne 4) {
            $payload += "=" * $padding
        }

        $payloadBytes = [System.Convert]::FromBase64String($payload)
        $payloadJson = [System.Text.Encoding]::UTF8.GetString($payloadBytes)
        $payloadObj = $payloadJson | ConvertFrom-Json

        $expDate = [DateTimeOffset]::FromUnixTimeSeconds($payloadObj.exp).ToLocalTime()
        $now = Get-Date

        Write-Host "Token expiry: $expDate" -ForegroundColor Gray
        if ($expDate -lt $now) {
            Write-Host "❌ Token is EXPIRED" -ForegroundColor Red
        } else {
            Write-Host "✅ Token is still valid" -ForegroundColor Green
        }

    } catch {
        Write-Host "❌ Failed to decode JWT: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Invalid JWT format" -ForegroundColor Red
}

# Test 5: JWKS endpoint
Write-Host "`n5️⃣ Testing JWKS Endpoint" -ForegroundColor Yellow
$jwksUrl = "https://virpalapp.ciamlogin.com/virpalapp.onmicrosoft.com/discovery/v2.0/keys"
try {
    $jwksResponse = Invoke-RestMethod -Uri $jwksUrl -Method GET -TimeoutSec 10
    Write-Host "✅ JWKS endpoint accessible" -ForegroundColor Green
    $keyCount = $jwksResponse.keys.Count
    Write-Host "Number of keys: $keyCount" -ForegroundColor Gray

    # Check if our kid exists
    $targetKid = "CNv0OI3RwqlHFEVnaomAshCH2XE"
    $targetKey = $jwksResponse.keys | Where-Object { $_.kid -eq $targetKid }
    if ($targetKey) {
        Write-Host "✅ Target key ID found in JWKS" -ForegroundColor Green
    } else {
        Write-Host "❌ Target key ID NOT found in JWKS" -ForegroundColor Red
        Write-Host "Available keys:" -ForegroundColor Gray
        $jwksResponse.keys | ForEach-Object { Write-Host "  - $($_.kid)" -ForegroundColor Gray }
    }
} catch {
    Write-Host "❌ JWKS endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔍 Diagnosis Complete" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check if Azure Functions are properly deployed" -ForegroundColor White
Write-Host "2. Verify environment variables in Azure portal" -ForegroundColor White
Write-Host "3. Check Managed Identity configuration" -ForegroundColor White
Write-Host "4. Test with fresh JWT token from browser" -ForegroundColor White
