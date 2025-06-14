#!/usr/bin/env powershell

<#
.SYNOPSIS
    Debug JWT authentication issues in production Azure Static Web Apps

.DESCRIPTION
    Script untuk membantu debug masalah JWT authentication di production:
    1. Test production endpoints
    2. Analisis response 401 Unauthorized
    3. Panduan untuk cek Azure Functions logs

.EXAMPLE
    .\debug-jwt-production.ps1
#>

param(
    [string]$ProductionUrl = "https://ashy-coast-0aeebe10f.6.azurestaticapps.net"
)

Write-Host "🔍 Debug JWT Authentication - Production Azure Static Web Apps" -ForegroundColor Cyan
Write-Host "Production URL: $ProductionUrl" -ForegroundColor Yellow
Write-Host ""

# Test endpoints
$endpoints = @(
    "/api/health",
    "/api/get-secret?name=azure-cosmos-db-connection-string"
)

Write-Host "📋 Testing API Endpoints..." -ForegroundColor Green
foreach ($endpoint in $endpoints) {
    $url = "$ProductionUrl$endpoint"
    Write-Host "Testing: $endpoint" -ForegroundColor White

    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Host "  ✅ Status: $($response.StatusCode)" -ForegroundColor Green
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  ❌ Status: $statusCode" -ForegroundColor Red
        if ($statusCode -eq 401) {
            Write-Host "  📝 Expected 401 for protected endpoint" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

Write-Host "🔧 Debug Steps untuk Azure Functions Logs:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Buka Azure Portal: https://portal.azure.com" -ForegroundColor White
Write-Host "2. Navigate ke Function App: virpal-app-functions" -ForegroundColor White
Write-Host "3. Pilih 'Logs' atau 'Monitor' > 'Logs'" -ForegroundColor White
Write-Host "4. Atau gunakan Live Metrics untuk real-time logging" -ForegroundColor White
Write-Host ""

Write-Host "📊 Query untuk Azure Function Logs:" -ForegroundColor Green
Write-Host ""
$kusto = @"
// Real-time function execution logs
traces
| where timestamp > ago(10m)
| where message contains "JWT" or message contains "TOKEN" or message contains "VALIDATION"
| order by timestamp desc
| limit 50

// Authentication related logs
traces
| where timestamp > ago(10m)
| where message contains "Authorization" or message contains "Bearer"
| order by timestamp desc
| limit 20

// Error logs
exceptions
| where timestamp > ago(10m)
| order by timestamp desc
| limit 10
"@

Write-Host $kusto -ForegroundColor Gray
Write-Host ""

Write-Host "🎯 Langkah Debug:" -ForegroundColor Cyan
Write-Host "1. Login ke frontend: $ProductionUrl" -ForegroundColor White
Write-Host "2. Buka Developer Console (F12)" -ForegroundColor White
Write-Host "3. Lihat Network tab untuk melihat request headers" -ForegroundColor White
Write-Host "4. Trigger request dengan: window.virpalDev.testGetSecret('azure-cosmos-db-connection-string')" -ForegroundColor White
Write-Host "5. Cek Azure Functions logs untuk melihat debug output" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Yang Perlu Dicek di Logs:" -ForegroundColor Yellow
Write-Host "- Apakah Authorization header diterima di backend?" -ForegroundColor White
Write-Host "- Isi token payload: aud, iss, scp, exp" -ForegroundColor White
Write-Host "- Expected vs received values" -ForegroundColor White
Write-Host "- Error message spesifik dari JWT validation" -ForegroundColor White
Write-Host ""

Write-Host "✅ Script Debug JWT Production Ready!" -ForegroundColor Green
