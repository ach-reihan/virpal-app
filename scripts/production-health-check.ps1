# Complete Production Health Check
# This script performs comprehensive health checks for the Virpal App

Write-Host "🏥 Virpal App - Production Health Check" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Get production URL from user
$ProductionUrl = Read-Host "Enter your production URL (e.g., https://your-app.azurestaticapps.net)"
if (-not $ProductionUrl) {
    Write-Host "❌ Production URL is required" -ForegroundColor Red
    exit 1
}

# Remove trailing slash if present
$ProductionUrl = $ProductionUrl.TrimEnd('/')

Write-Host "`n🌐 Testing Production Environment: $ProductionUrl" -ForegroundColor Yellow

# Function to test HTTP endpoint
function Test-HttpEndpoint {
    param(
        [string]$Url,
        [string]$Name,
        [string]$Method = "GET",
        [string]$Body = $null,
        [hashtable]$ExpectedResponses = @{200 = "OK"},
        [int]$TimeoutSec = 30
    )

    Write-Host "`n🔍 Testing: $Name" -ForegroundColor Green
    Write-Host "   URL: $Url" -ForegroundColor Gray
    Write-Host "   Method: $Method" -ForegroundColor Gray

    try {
        $params = @{
            Uri = $Url
            Method = $Method
            TimeoutSec = $TimeoutSec
            UseBasicParsing = $true
        }

        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }

        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest @params
        $sw.Stop()

        $statusCode = [int]$response.StatusCode
        $responseTime = $sw.ElapsedMilliseconds

        $isExpected = $ExpectedResponses.ContainsKey($statusCode)
        $status = if ($isExpected) { "✅" } else { "⚠️ " }

        Write-Host "   $status Status: $statusCode ($($response.StatusDescription))" -ForegroundColor $(if ($isExpected) { "Green" } else { "Yellow" })
        Write-Host "   ⏱️  Response Time: ${responseTime}ms" -ForegroundColor Gray
        Write-Host "   📏 Content Length: $($response.Content.Length) bytes" -ForegroundColor Gray

        # Show response content for small responses
        if ($response.Content.Length -lt 500 -and $response.Content.Length -gt 0) {
            Write-Host "   📄 Response: $($response.Content)" -ForegroundColor Gray
        }

        return @{
            Success = $isExpected
            StatusCode = $statusCode
            ResponseTime = $responseTime
            ContentLength = $response.Content.Length
        }
    }
    catch {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red

        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            Write-Host "   📊 Status Code: $statusCode" -ForegroundColor Red
        }

        return @{
            Success = $false
            StatusCode = $statusCode
            Error = $_.Exception.Message
        }
    }
}

# Define test cases
$tests = @(
    @{
        Name = "Frontend - Homepage"
        Url = $ProductionUrl
        Method = "GET"
        ExpectedResponses = @{200 = "OK"}
    },
    @{
        Name = "API - Health Check"
        Url = "$ProductionUrl/api/health"
        Method = "GET"
        ExpectedResponses = @{200 = "OK"}
    },
    @{
        Name = "API - Get Secret (POST with empty body)"
        Url = "$ProductionUrl/api/get-secret"
        Method = "POST"
        Body = "{}"
        ExpectedResponses = @{400 = "Bad Request (Expected)", 401 = "Unauthorized", 500 = "Server Error"}
    },
    @{
        Name = "API - Chat Completion (POST with empty body)"
        Url = "$ProductionUrl/api/chat-completion"
        Method = "POST"
        Body = "{}"
        ExpectedResponses = @{400 = "Bad Request (Expected)", 401 = "Unauthorized", 500 = "Server Error"}
    },
    @{
        Name = "API - Get Secret (POST with test data)"
        Url = "$ProductionUrl/api/get-secret"
        Method = "POST"
        Body = '{"secretName": "test-secret"}'
        ExpectedResponses = @{200 = "OK", 404 = "Not Found", 401 = "Unauthorized", 500 = "Server Error"}
    },
    @{
        Name = "API - Chat Completion (POST with test data)"
        Url = "$ProductionUrl/api/chat-completion"
        Method = "POST"
        Body = '{"messages": [{"role": "user", "content": "Hello"}], "maxTokens": 10}'
        ExpectedResponses = @{200 = "OK", 401 = "Unauthorized", 500 = "Server Error"}
    }
)

# Run tests
$results = @()
$totalTests = $tests.Count
$passedTests = 0

foreach ($test in $tests) {
    $result = Test-HttpEndpoint -Url $test.Url -Name $test.Name -Method $test.Method -Body $test.Body -ExpectedResponses $test.ExpectedResponses
    $results += $result

    if ($result.Success) {
        $passedTests++
    }

    Start-Sleep -Milliseconds 500  # Small delay between requests
}

# Summary Report
Write-Host "`n📊 Health Check Summary" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host "Total Tests: $totalTests" -ForegroundColor Gray
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $($totalTests - $passedTests)" -ForegroundColor Red

$overallHealth = if ($passedTests -eq $totalTests) { "HEALTHY" } elseif ($passedTests -gt 0) { "PARTIAL" } else { "UNHEALTHY" }
$healthColor = switch ($overallHealth) {
    "HEALTHY" { "Green" }
    "PARTIAL" { "Yellow" }
    "UNHEALTHY" { "Red" }
}

Write-Host "`nOverall Status: $overallHealth" -ForegroundColor $healthColor

# Detailed analysis
if ($overallHealth -ne "HEALTHY") {
    Write-Host "`n🔧 Troubleshooting Recommendations:" -ForegroundColor Yellow

    $frontendFailed = $results[0].Success -eq $false
    $healthFailed = $results[1].Success -eq $false
    $apiFailed = ($results[2..5] | Where-Object { $_.Success -eq $false }).Count -gt 0

    if ($frontendFailed) {
        Write-Host "• Frontend not accessible - check Static Web Apps deployment" -ForegroundColor Red
    }

    if ($healthFailed) {
        Write-Host "• Health endpoint failing - Azure Functions may not be deployed correctly" -ForegroundColor Red
    }

    if ($apiFailed) {
        Write-Host "• API endpoints having issues - check:" -ForegroundColor Red
        Write-Host "  - Environment variables in Azure Portal" -ForegroundColor Gray
        Write-Host "  - Azure Functions deployment status" -ForegroundColor Gray
        Write-Host "  - Application Insights logs" -ForegroundColor Gray
    }

    Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Check Azure Portal -> Static Web Apps -> Your App -> Functions" -ForegroundColor Gray
    Write-Host "2. Verify Environment Variables are set correctly" -ForegroundColor Gray
    Write-Host "3. Check Application Insights for detailed error logs" -ForegroundColor Gray
    Write-Host "4. Run: az staticwebapp show -n your-app-name -g your-resource-group" -ForegroundColor Gray
}

Write-Host "`n✨ Health check completed!" -ForegroundColor Green
