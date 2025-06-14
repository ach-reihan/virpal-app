# Test Production API Endpoints
# This script tests the Azure Functions API endpoints in production

param(
    [Parameter(Mandatory=$true)]
    [string]$ProductionUrl
)

Write-Host "🚀 Testing Production API Endpoints..." -ForegroundColor Cyan
Write-Host "Base URL: $ProductionUrl" -ForegroundColor Yellow

# Function to test an endpoint
function Test-Endpoint {
    param(
        [string]$Url,
        [string]$EndpointName,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )

    Write-Host "`n📍 Testing $EndpointName..." -ForegroundColor Green
    Write-Host "URL: $Url" -ForegroundColor Gray

    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            TimeoutSec = 30
        }

        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }

        $response = Invoke-WebRequest @params

        Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "✅ Content Length: $($response.Content.Length) bytes" -ForegroundColor Green

        if ($response.Content.Length -lt 1000) {
            Write-Host "Response: $($response.Content)" -ForegroundColor Gray
        } else {
            Write-Host "Response (first 200 chars): $($response.Content.Substring(0, 200))..." -ForegroundColor Gray
        }

        return $true
    }
    catch {
        Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response) {
            Write-Host "❌ Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
        return $false
    }
}

# Test endpoints
$endpoints = @(
    @{
        Name = "Health Check"
        Path = "/api/health"
        Method = "GET"
    },
    @{
        Name = "Get Secret (Test)"
        Path = "/api/get-secret"
        Method = "POST"
        Body = '{"secretName": "test-secret"}'
    },
    @{
        Name = "Chat Completion (Test)"
        Path = "/api/chat-completion"
        Method = "POST"
        Body = '{"messages": [{"role": "user", "content": "Hello, test message"}], "maxTokens": 50}'
    }
)

$results = @{}

foreach ($endpoint in $endpoints) {
    $url = "$ProductionUrl$($endpoint.Path)"

    $params = @{
        Url = $url
        EndpointName = $endpoint.Name
        Method = $endpoint.Method
    }

    if ($endpoint.Body) {
        $params.Body = $endpoint.Body
    }

    $results[$endpoint.Name] = Test-Endpoint @params
    Start-Sleep -Seconds 2
}

# Summary
Write-Host "`n📊 Test Summary:" -ForegroundColor Cyan
foreach ($result in $results.GetEnumerator()) {
    $status = if ($result.Value) { "✅ PASS" } else { "❌ FAIL" }
    Write-Host "  $($result.Key): $status" -ForegroundColor $(if ($result.Value) { "Green" } else { "Red" })
}

$totalPassed = ($results.Values | Where-Object { $_ }).Count
$totalTests = $results.Count

Write-Host "`n🎯 Overall Result: $totalPassed/$totalTests tests passed" -ForegroundColor $(if ($totalPassed -eq $totalTests) { "Green" } else { "Yellow" })

if ($totalPassed -ne $totalTests) {
    Write-Host "`n💡 Troubleshooting Tips:" -ForegroundColor Yellow
    Write-Host "1. Check Azure Functions logs in Azure Portal" -ForegroundColor Gray
    Write-Host "2. Verify environment variables are set in Azure SWA" -ForegroundColor Gray
    Write-Host "3. Check if API functions are properly deployed" -ForegroundColor Gray
    Write-Host "4. Verify staticwebapp.config.json routing rules" -ForegroundColor Gray
}
