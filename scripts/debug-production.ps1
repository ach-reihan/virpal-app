# Script untuk debugging production issues di Azure Static Web Apps
# Melakukan diagnostic komprehensif untuk troubleshooting

param(
    [Parameter(Mandatory=$true)]
    [string]$StaticWebAppName,

    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,

    [switch]$Detailed
)

function Write-Section {
    param([string]$Title)
    Write-Host "`n$('='*60)" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host $('='*60) -ForegroundColor Cyan
}

function Test-Endpoint {
    param(
        [string]$Url,
        [string]$Name,
        [hashtable]$Headers = @{},
        [string]$Method = "GET",
        [object]$Body = $null
    )

    Write-Host "`n🌐 Testing $Name..." -ForegroundColor Yellow
    Write-Host "URL: $Url" -ForegroundColor White

    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ErrorAction = "Stop"
            TimeoutSec = 30
        }

        if ($Headers.Count -gt 0) {
            $params.Headers = $Headers
        }

        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
            $params.ContentType = "application/json"
        }

        $response = Invoke-RestMethod @params
        Write-Host "✅ $Name: SUCCESS" -ForegroundColor Green

        if ($Detailed) {
            Write-Host "Response:" -ForegroundColor White
            Write-Host ($response | ConvertTo-Json -Depth 3) -ForegroundColor Gray
        }

        return $true
    } catch {
        Write-Host "❌ $Name: FAILED" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red

        if ($_.Exception.Response) {
            Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
            Write-Host "Status Description: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
        }

        return $false
    }
}

Write-Host "🔍 Azure Static Web Apps Production Diagnostic Tool" -ForegroundColor Cyan
Write-Host "App: $StaticWebAppName | Resource Group: $ResourceGroupName" -ForegroundColor White

# 1. Basic Azure Resource Info
Write-Section "1. Azure Resource Information"

try {
    $swaInfo = az staticwebapp show -n $StaticWebAppName -g $ResourceGroupName | ConvertFrom-Json

    Write-Host "✅ Static Web App found" -ForegroundColor Green
    Write-Host "Name: $($swaInfo.name)" -ForegroundColor White
    Write-Host "Location: $($swaInfo.location)" -ForegroundColor White
    Write-Host "Default Hostname: $($swaInfo.defaultHostname)" -ForegroundColor White
    Write-Host "Pricing Tier: $($swaInfo.sku.name)" -ForegroundColor White
    Write-Host "Resource ID: $($swaInfo.id)" -ForegroundColor Gray

    $appUrl = $swaInfo.defaultHostname
} catch {
    Write-Host "❌ Failed to get Static Web App info: $_" -ForegroundColor Red
    exit 1
}

# 2. Environment Variables
Write-Section "2. Environment Variables"

try {
    $appSettings = az staticwebapp appsettings list -n $StaticWebAppName -g $ResourceGroupName | ConvertFrom-Json

    if ($appSettings.Count -gt 0) {
        Write-Host "✅ Found $($appSettings.Count) environment variables:" -ForegroundColor Green
        foreach ($setting in $appSettings) {
            $value = if ($setting.name -like "*KEY*" -or $setting.name -like "*SECRET*" -or $setting.name -like "*CONNECTION*") {
                "[HIDDEN]"
            } else {
                $setting.value
            }
            Write-Host "  $($setting.name): $value" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️ No environment variables configured" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to get app settings: $_" -ForegroundColor Red
}

# 3. Managed Identity
Write-Section "3. Managed Identity & Permissions"

try {
    $identity = az staticwebapp identity show -n $StaticWebAppName -g $ResourceGroupName 2>$null | ConvertFrom-Json

    if ($identity -and $identity.principalId) {
        Write-Host "✅ Managed identity enabled" -ForegroundColor Green
        Write-Host "Principal ID: $($identity.principalId)" -ForegroundColor White
        Write-Host "Tenant ID: $($identity.tenantId)" -ForegroundColor White
        Write-Host "Type: $($identity.type)" -ForegroundColor White
    } else {
        Write-Host "⚠️ Managed identity not enabled" -ForegroundColor Yellow
        Write-Host "To enable: az staticwebapp identity assign -n $StaticWebAppName -g $ResourceGroupName" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Failed to check managed identity: $_" -ForegroundColor Red
}

# 4. Deployments
Write-Section "4. Recent Deployments"

try {
    $deployments = az staticwebapp deployment list -n $StaticWebAppName -g $ResourceGroupName | ConvertFrom-Json

    if ($deployments.Count -gt 0) {
        Write-Host "✅ Found $($deployments.Count) deployments" -ForegroundColor Green

        $recent = $deployments | Sort-Object createdDate -Descending | Select-Object -First 3
        foreach ($deployment in $recent) {
            $status = if ($deployment.status -eq "Ready") { "✅" } else { "❌" }
            Write-Host "$status $($deployment.createdDate) | $($deployment.status) | $($deployment.id)" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️ No deployments found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to get deployments: $_" -ForegroundColor Red
}

# 5. API Functions
Write-Section "5. Azure Functions"

try {
    $functions = az staticwebapp functions list -n $StaticWebAppName -g $ResourceGroupName 2>$null | ConvertFrom-Json

    if ($functions -and $functions.Count -gt 0) {
        Write-Host "✅ Found $($functions.Count) functions:" -ForegroundColor Green
        foreach ($func in $functions) {
            Write-Host "  📦 $($func.name)" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️ No functions deployed or functions list not available" -ForegroundColor Yellow
        Write-Host "This may indicate API deployment issues" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️ Functions list not available (may be normal for Static Web Apps)" -ForegroundColor Yellow
}

# 6. Endpoint Testing
Write-Section "6. Endpoint Testing"

if ($appUrl) {
    $baseUrl = "https://$appUrl"

    # Test frontend
    $frontendOk = Test-Endpoint -Url $baseUrl -Name "Frontend (index.html)"

    # Test API endpoints
    $healthOk = Test-Endpoint -Url "$baseUrl/api/health" -Name "Health API"

    # Test get-secret dengan contoh request
    $getSecretBody = @{ secretName = "test-secret" }
    $getSecretOk = Test-Endpoint -Url "$baseUrl/api/get-secret" -Name "Get Secret API" -Method "POST" -Body $getSecretBody

    # Test dengan Authorization header (jika ada token)
    if ($env:TEST_JWT_TOKEN) {
        Write-Host "`n🔑 Testing with Authorization header..." -ForegroundColor Yellow
        $authHeaders = @{ "Authorization" = "Bearer $env:TEST_JWT_TOKEN" }
        Test-Endpoint -Url "$baseUrl/api/get-secret" -Name "Get Secret API (with auth)" -Method "POST" -Body $getSecretBody -Headers $authHeaders
    } else {
        Write-Host "`n💡 Set TEST_JWT_TOKEN environment variable to test with authorization" -ForegroundColor Gray
    }

    # Summary
    Write-Section "7. Summary"

    $issues = @()
    if (-not $frontendOk) { $issues += "Frontend not accessible" }
    if (-not $healthOk) { $issues += "Health API not working" }
    if (-not $getSecretOk) { $issues += "Get Secret API not working" }

    if ($issues.Count -eq 0) {
        Write-Host "🎉 All basic tests passed!" -ForegroundColor Green
    } else {
        Write-Host "❌ Issues found:" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "  • $issue" -ForegroundColor Red
        }
    }

} else {
    Write-Host "❌ Could not determine app URL" -ForegroundColor Red
}

# 8. Recommendations
Write-Section "8. Troubleshooting Recommendations"

Write-Host "📋 Common issues and solutions:" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔧 Environment Variables Issues:" -ForegroundColor Cyan
Write-Host "   • Run: .\scripts\configure-swa-environment.ps1 -StaticWebAppName '$StaticWebAppName' -ResourceGroupName '$ResourceGroupName'" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 API Functions Not Working:" -ForegroundColor Cyan
Write-Host "   • Check if functions are built: npm run functions:build" -ForegroundColor Gray
Write-Host "   • Redeploy: git push origin main" -ForegroundColor Gray
Write-Host "   • Check GitHub Actions workflow" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 Authentication Issues:" -ForegroundColor Cyan
Write-Host "   • Verify JWT token structure and signature" -ForegroundColor Gray
Write-Host "   • Check Microsoft Entra External ID configuration" -ForegroundColor Gray
Write-Host "   • Ensure frontend sends Authorization header" -ForegroundColor Gray
Write-Host ""
Write-Host "🔧 Key Vault Access Issues:" -ForegroundColor Cyan
Write-Host "   • Enable managed identity: az staticwebapp identity assign -n '$StaticWebAppName' -g '$ResourceGroupName'" -ForegroundColor Gray
Write-Host "   • Set Key Vault access policy for the principal ID" -ForegroundColor Gray

Write-Host "`n✨ Diagnostic complete!" -ForegroundColor Green
