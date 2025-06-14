# Azure Functions Runtime Test Script
# This script tests if chat-completion function is running in production

param(
    [string]$Environment = "production",
    [string]$BaseUrl = "https://ashy-coast-0aeebe10f.6.azurestaticapps.net"
)

Write-Host "🧪 Testing Azure Functions Runtime - $Environment" -ForegroundColor Cyan
Write-Host "📍 Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host ""

# Test 1: Health Check
Write-Host "1️⃣ Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-WebRequest -Uri "$BaseUrl/api/health" -Method GET -ErrorAction Stop
    Write-Host "✅ Health Status: $($healthResponse.StatusCode)" -ForegroundColor Green
    $healthData = $healthResponse.Content | ConvertFrom-Json
    Write-Host "📄 Health Response:" -ForegroundColor Gray
    Write-Host $healthResponse.Content -ForegroundColor Gray
} catch {
    Write-Host "❌ Health Check Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Test Chat Runtime
Write-Host "2️⃣ Testing Chat Runtime Endpoint..." -ForegroundColor Yellow
try {
    $runtimeResponse = Invoke-WebRequest -Uri "$BaseUrl/api/test-chat-runtime" -Method GET -ErrorAction Stop
    Write-Host "✅ Runtime Status: $($runtimeResponse.StatusCode)" -ForegroundColor Green
    Write-Host "📄 Runtime Response:" -ForegroundColor Gray
    Write-Host $runtimeResponse.Content -ForegroundColor Gray
} catch {
    Write-Host "❌ Runtime Test Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Chat Completion CORS Preflight
Write-Host "3️⃣ Testing Chat Completion CORS..." -ForegroundColor Yellow
try {
    $corsHeaders = @{
        'Origin' = 'https://ashy-coast-0aeebe10f.6.azurestaticapps.net'
        'Access-Control-Request-Method' = 'POST'
        'Access-Control-Request-Headers' = 'Content-Type,Authorization'
    }
    $corsResponse = Invoke-WebRequest -Uri "$BaseUrl/api/chat-completion" -Method OPTIONS -Headers $corsHeaders -ErrorAction Stop
    Write-Host "✅ CORS Status: $($corsResponse.StatusCode)" -ForegroundColor Green
    Write-Host "📄 CORS Headers:" -ForegroundColor Gray
    $corsResponse.Headers.GetEnumerator() | Where-Object { $_.Key -like "*Access-Control*" } | ForEach-Object {
        Write-Host "  $($_.Key): $($_.Value)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ CORS Test Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Chat Completion POST (Guest Mode)
Write-Host "4️⃣ Testing Chat Completion POST (Guest Mode)..." -ForegroundColor Yellow
try {
    $requestBody = @{
        userInput = "Hello, test message"
        maxTokens = 50
    } | ConvertTo-Json

    $chatHeaders = @{
        'Content-Type' = 'application/json'
        'X-Guest-Mode' = 'true'
        'Origin' = 'https://ashy-coast-0aeebe10f.6.azurestaticapps.net'
    }

    $chatResponse = Invoke-WebRequest -Uri "$BaseUrl/api/chat-completion" -Method POST -Body $requestBody -Headers $chatHeaders -ErrorAction Stop
    Write-Host "✅ Chat Status: $($chatResponse.StatusCode)" -ForegroundColor Green
    Write-Host "📄 Chat Response:" -ForegroundColor Gray
    Write-Host $chatResponse.Content -ForegroundColor Gray
} catch {
    Write-Host "❌ Chat Completion Failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorContent = $reader.ReadToEnd()
        Write-Host "📄 Error Details:" -ForegroundColor Red
        Write-Host $errorContent -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🏁 Test Complete!" -ForegroundColor Cyan
