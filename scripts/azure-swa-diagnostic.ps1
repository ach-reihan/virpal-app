# Azure Static Web Apps Diagnostic Script
# This script helps diagnose deployment and runtime issues

param(
    [string]$ResourceGroupName,
    [string]$StaticWebAppName,
    [string]$SubscriptionId
)

Write-Host "🔍 Azure Static Web Apps Diagnostic Tool" -ForegroundColor Cyan

# Function to check if user is logged in to Azure
function Test-AzureLogin {
    try {
        $context = az account show 2>$null | ConvertFrom-Json
        if ($context) {
            Write-Host "✅ Logged in to Azure as: $($context.user.name)" -ForegroundColor Green
            Write-Host "   Subscription: $($context.name) ($($context.id))" -ForegroundColor Gray
            return $true
        }
    }
    catch {
        # Ignore errors
    }

    Write-Host "❌ Not logged in to Azure" -ForegroundColor Red
    Write-Host "Please run: az login" -ForegroundColor Yellow
    return $false
}

# Function to list Static Web Apps if parameters not provided
function Get-StaticWebApps {
    Write-Host "`n📋 Available Static Web Apps:" -ForegroundColor Yellow

    try {
        $apps = az staticwebapp list --query "[].{name:name, resourceGroup:resourceGroup, defaultHostname:defaultHostname}" -o json | ConvertFrom-Json

        if ($apps.Count -eq 0) {
            Write-Host "No Static Web Apps found in current subscription" -ForegroundColor Red
            return
        }

        foreach ($app in $apps) {
            Write-Host "  Name: $($app.name)" -ForegroundColor Green
            Write-Host "  Resource Group: $($app.resourceGroup)" -ForegroundColor Gray
            Write-Host "  URL: https://$($app.defaultHostname)" -ForegroundColor Gray
            Write-Host "  ---" -ForegroundColor Gray
        }
    }
    catch {
        Write-Host "Error listing Static Web Apps: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to get deployment status
function Get-DeploymentStatus {
    param([string]$ResourceGroup, [string]$AppName)

    Write-Host "`n🚀 Getting deployment status..." -ForegroundColor Yellow

    try {
        $deployments = az staticwebapp show -n $AppName -g $ResourceGroup --query "deployments" -o json | ConvertFrom-Json

        if ($deployments) {
            Write-Host "Recent deployments found" -ForegroundColor Green
        } else {
            Write-Host "No deployment information available" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "Error getting deployment status: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to test API endpoints
function Test-ApiEndpoints {
    param([string]$BaseUrl)

    Write-Host "`n🔗 Testing API endpoints..." -ForegroundColor Yellow

    $endpoints = @("/api/health", "/api/get-secret", "/api/chat-completion")

    foreach ($endpoint in $endpoints) {
        $url = "$BaseUrl$endpoint"
        Write-Host "Testing: $url" -ForegroundColor Gray

        try {
            if ($endpoint -eq "/api/health") {
                $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 10
            } else {
                # For other endpoints, just check if they're reachable (might return 400 for missing body)
                $response = Invoke-WebRequest -Uri $url -Method POST -TimeoutSec 10 -Body "{}" -ContentType "application/json"
            }

            Write-Host "  ✅ Status: $($response.StatusCode)" -ForegroundColor Green
        }
        catch {
            $statusCode = if ($_.Exception.Response) { $_.Exception.Response.StatusCode } else { "Unknown" }
            if ($statusCode -eq 400) {
                Write-Host "  ⚠️  Status: 400 (Expected for endpoints requiring specific input)" -ForegroundColor Yellow
            } else {
                Write-Host "  ❌ Status: $statusCode" -ForegroundColor Red
            }
        }
    }
}

# Function to get app configuration
function Get-AppConfiguration {
    param([string]$ResourceGroup, [string]$AppName)

    Write-Host "`n⚙️  Getting app configuration..." -ForegroundColor Yellow

    try {
        # Get app settings
        Write-Host "Application Settings:" -ForegroundColor Gray
        $settings = az staticwebapp appsettings list -n $AppName -g $ResourceGroup -o json | ConvertFrom-Json

        if ($settings) {
            foreach ($setting in $settings.PSObject.Properties) {
                $value = if ($setting.Value -like "*secret*" -or $setting.Value -like "*key*") { "***REDACTED***" } else { $setting.Value }
                Write-Host "  $($setting.Name): $value" -ForegroundColor Gray
            }
        } else {
            Write-Host "  No application settings found" -ForegroundColor Yellow
        }

        # Get function app settings if available
        Write-Host "`nFunction App Configuration:" -ForegroundColor Gray
        $appDetails = az staticwebapp show -n $AppName -g $ResourceGroup -o json | ConvertFrom-Json
        Write-Host "  API Runtime: $($appDetails.buildProperties.apiLocation)" -ForegroundColor Gray
    }
    catch {
        Write-Host "Error getting app configuration: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Main execution
if (-not (Test-AzureLogin)) {
    exit 1
}

if (-not $ResourceGroupName -or -not $StaticWebAppName) {
    Get-StaticWebApps
    Write-Host "`n💡 Usage: .\azure-swa-diagnostic.ps1 -ResourceGroupName 'your-rg' -StaticWebAppName 'your-app'" -ForegroundColor Yellow
    exit 0
}

# Set subscription if provided
if ($SubscriptionId) {
    Write-Host "Setting subscription to: $SubscriptionId" -ForegroundColor Yellow
    az account set --subscription $SubscriptionId
}

# Get Static Web App details
Write-Host "`n📱 Getting Static Web App details..." -ForegroundColor Yellow
try {
    $app = az staticwebapp show -n $StaticWebAppName -g $ResourceGroupName -o json | ConvertFrom-Json
    $appUrl = "https://$($app.defaultHostname)"

    Write-Host "✅ Found Static Web App:" -ForegroundColor Green
    Write-Host "  Name: $($app.name)" -ForegroundColor Gray
    Write-Host "  Resource Group: $($app.resourceGroup)" -ForegroundColor Gray
    Write-Host "  URL: $appUrl" -ForegroundColor Gray
    Write-Host "  Status: $($app.status)" -ForegroundColor Gray
    Write-Host "  SKU: $($app.sku.name)" -ForegroundColor Gray

    # Run diagnostics
    Get-DeploymentStatus -ResourceGroup $ResourceGroupName -AppName $StaticWebAppName
    Get-AppConfiguration -ResourceGroup $ResourceGroupName -AppName $StaticWebAppName
    Test-ApiEndpoints -BaseUrl $appUrl

    Write-Host "`n🎯 Diagnostic Complete!" -ForegroundColor Cyan
    Write-Host "App URL: $appUrl" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error: Could not find Static Web App '$StaticWebAppName' in resource group '$ResourceGroupName'" -ForegroundColor Red
    Write-Host "Please check the names and try again." -ForegroundColor Yellow
}
