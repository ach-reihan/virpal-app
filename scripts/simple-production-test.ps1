# Simple Production Test Script
Write-Host "🏥 Testing Production API Endpoints" -ForegroundColor Cyan

# Get production URL
$ProductionUrl = Read-Host "Masukkan URL production Anda (contoh: https://your-app.azurestaticapps.net)"
if (-not $ProductionUrl) {
    Write-Host "❌ URL production diperlukan" -ForegroundColor Red
    exit 1
}

# Remove trailing slash
$ProductionUrl = $ProductionUrl.TrimEnd('/')

Write-Host "`n🌐 Testing: $ProductionUrl" -ForegroundColor Yellow

# Test function
function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Name,
        [string]$Method = "GET",
        [string]$Body = $null
    )
    
    Write-Host "`n🔍 Testing: $Name" -ForegroundColor Green
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            TimeoutSec = 30
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        $statusCode = [int]$response.StatusCode
        
        Write-Host "   ✅ Status: $statusCode" -ForegroundColor Green
        Write-Host "   📏 Size: $($response.Content.Length) bytes" -ForegroundColor Gray
        
        if ($response.Content.Length -lt 300) {
            Write-Host "   📄 Response: $($response.Content)" -ForegroundColor Gray
        }
        
        return @{ Success = $true; StatusCode = $statusCode }
    }
    catch {
        $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "Unknown" }
        Write-Host "   ❌ Error: $statusCode - $($_.Exception.Message)" -ForegroundColor Red
        return @{ Success = $false; StatusCode = $statusCode }
    }
}

# Run tests
Write-Host "`n📋 Running Tests..." -ForegroundColor Cyan

$results = @()

# Test 1: Frontend
$result = Test-Endpoint -Url $ProductionUrl -Name "Frontend Homepage"
$results += $result

# Test 2: Health endpoint
$result = Test-Endpoint -Url "$ProductionUrl/api/health" -Name "API Health Check"
$results += $result

# Test 3: Get Secret (empty)
$result = Test-Endpoint -Url "$ProductionUrl/api/get-secret" -Name "Get Secret (Empty Body)" -Method "POST" -Body "{}"
$results += $result

# Test 4: Chat Completion (empty)
$result = Test-Endpoint -Url "$ProductionUrl/api/chat-completion" -Name "Chat Completion (Empty Body)" -Method "POST" -Body "{}"
$results += $result

# Test 5: Get Secret (test data)
$result = Test-Endpoint -Url "$ProductionUrl/api/get-secret" -Name "Get Secret (Test Data)" -Method "POST" -Body '{"secretName": "test-secret"}'
$results += $result

# Test 6: Chat Completion (test data)
$result = Test-Endpoint -Url "$ProductionUrl/api/chat-completion" -Name "Chat Completion (Test Data)" -Method "POST" -Body '{"messages": [{"role": "user", "content": "Hello"}], "maxTokens": 10}'
$results += $result

# Summary
Write-Host "`n📊 Test Summary" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan

$passed = ($results | Where-Object { $_.Success }).Count
$total = $results.Count

Write-Host "Passed: $passed/$total" -ForegroundColor $(if ($passed -eq $total) { "Green" } else { "Yellow" })

# Analysis
Write-Host "`n🔍 Analysis:" -ForegroundColor Cyan

$frontendOK = $results[0].Success
$healthOK = $results[1].Success
$apiResponding = ($results[2..5] | Where-Object { $_.StatusCode -ne 404 -and $_.StatusCode -ne "Unknown" }).Count -gt 0

if ($frontendOK) {
    Write-Host "✅ Frontend accessible" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend not accessible" -ForegroundColor Red
}

if ($healthOK) {
    Write-Host "✅ API Health endpoint working" -ForegroundColor Green
} else {
    Write-Host "❌ API Health endpoint failing" -ForegroundColor Red
}

if ($apiResponding) {
    Write-Host "✅ API endpoints responding (not 404)" -ForegroundColor Green
} else {
    Write-Host "❌ API endpoints returning 404 - Functions may not be deployed" -ForegroundColor Red
}

# Recommendations
if (-not $frontendOK -or -not $healthOK -or -not $apiResponding) {
    Write-Host "`n💡 Recommendations:" -ForegroundColor Yellow
    if (-not $frontendOK) {
        Write-Host "• Check Static Web Apps deployment status" -ForegroundColor Gray
    }
    if (-not $healthOK -or -not $apiResponding) {
        Write-Host "• Verify Azure Functions are deployed correctly" -ForegroundColor Gray
        Write-Host "• Check environment variables in Azure Portal" -ForegroundColor Gray
        Write-Host "• Review GitHub Actions workflow logs" -ForegroundColor Gray
    }
}

Write-Host "`n✨ Testing complete!" -ForegroundColor Green
