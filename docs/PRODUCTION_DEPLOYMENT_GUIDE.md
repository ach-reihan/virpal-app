# Production Deployment Guide

This guide will help you deploy the Virpal application to Azure.

## Architecture

The application consists of two main components:

1. **Frontend**: React application built with Vite
2. **Backend**: Azure Functions with ES modules support

## Prerequisites

- Azure subscription
- Azure CLI installed and logged in
- Node.js 20.x or higher
- PowerShell 7.0 or higher

## Step 1: Provision Azure Resources

First, create the necessary Azure resources:

```pwsh
# Login to Azure
az login

# Set variables
$resourceGroup = "virpal-app-rg"
$location = "eastus"
$storageAccName = "virpalstorageacc"
$functionAppName = "virpal-function-app"
$keyVaultName = "virpal-key-vault"
$speechServiceName = "virpal-speech-service"
$appServicePlanName = "virpal-app-plan"
$staticWebAppName = "virpal-static-web"

# Create resource group
az group create --name $resourceGroup --location $location

# Create storage account for Functions
az storage account create --name $storageAccName --resource-group $resourceGroup --location $location --sku Standard_LRS

# Create App Service Plan
az appservice plan create --name $appServicePlanName --resource-group $resourceGroup --location $location --sku B1

# Create Function App
az functionapp create --name $functionAppName --resource-group $resourceGroup --storage-account $storageAccName --runtime node --runtime-version 20 --functions-version 4 --os-type Windows --plan $appServicePlanName

# Create Key Vault
az keyvault create --name $keyVaultName --resource-group $resourceGroup --location $location

# Create Speech Service
az cognitiveservices account create --name $speechServiceName --resource-group $resourceGroup --location $location --kind SpeechServices --sku S0

# Create Static Web App
az staticwebapp create --name $staticWebAppName --resource-group $resourceGroup --location $location
```

## Step 2: Configure Key Vault

Store your speech service credentials in Key Vault:

```pwsh
# Get Speech Service key
$speechKey = az cognitiveservices account keys list --name $speechServiceName --resource-group $resourceGroup --query "key1" -o tsv

# Add secrets to Key Vault
az keyvault secret set --vault-name $keyVaultName --name "azure-speech-service-key" --value $speechKey
az keyvault secret set --vault-name $keyVaultName --name "azure-speech-service-region" --value $location

# Grant Function App access to Key Vault
$functionAppPrincipalId = az functionapp identity assign --name $functionAppName --resource-group $resourceGroup --query principalId -o tsv
az keyvault set-policy --name $keyVaultName --object-id $functionAppPrincipalId --secret-permissions get list
```

## Step 3: Prepare Application for Production

Run the production preparation script:

```pwsh
./scripts/prepare-production-deployment.ps1
```

This will:

1. Update CORS settings for production
2. Build frontend assets
3. Build Azure Functions
4. Create deployment packages

## Step 4: Deploy the Application

### Deploy Azure Functions

```pwsh
cd deployment/backend
func azure functionapp publish $functionAppName
```

### Deploy Frontend to Static Web App

```pwsh
cd deployment/frontend
$apiToken = az staticwebapp secrets list --name $staticWebAppName --resource-group $resourceGroup --query "properties.apiKey" -o tsv
npx @azure/static-web-apps-cli deploy . --api-key $apiToken --app-name $staticWebAppName --env production
```

## Step 5: Configure Application Settings

Set the Key Vault URL in the Function App settings:

```pwsh
az functionapp config appsettings set --name $functionAppName --resource-group $resourceGroup --settings KEY_VAULT_URL="https://$keyVaultName.vault.azure.net/"
```

## Step 6: Configure Frontend API URL

Update the Static Web App configuration to point to your Function App:

```pwsh
$functionAppUrl = "https://$functionAppName.azurewebsites.net"
az staticwebapp appsettings set --name $staticWebAppName --resource-group $resourceGroup --setting-names VITE_AZURE_FUNCTION_URL=$functionAppUrl
```

## Verification

1. Navigate to your Static Web App URL to verify the frontend is working
2. Test the TTS functionality to ensure it's connecting to your Azure Functions
3. Monitor the Function App logs for any errors

## Troubleshooting

### Common Issues and Solutions

#### 1. API Endpoints Returning 404/500 Errors

**Symptoms**: API calls to `/api/health`, `/api/get-secret`, or `/api/chat-completion` return 404 or 500 errors.

**Solutions**:

```pwsh
# Use the production health check script
.\scripts\production-health-check.ps1

# Check Azure Functions deployment status
az staticwebapp show -n $staticWebAppName -g $resourceGroup --query "buildProperties"

# Verify functions are deployed
az staticwebapp functions list -n $staticWebAppName -g $resourceGroup
```

**Common Causes**:

- Environment variables not set in Azure Static Web Apps
- Functions not properly built or deployed
- Incorrect `staticwebapp.config.json` configuration

#### 2. Environment Variables Issues

**Check Environment Variables**:

```pwsh
# List current app settings
az staticwebapp appsettings list -n $staticWebAppName -g $resourceGroup

# Set missing environment variables
az staticwebapp appsettings set -n $staticWebAppName -g $resourceGroup --setting-names KEY_VAULT_URL="https://your-keyvault.vault.azure.net/"
```

**Required Environment Variables**:

- `KEY_VAULT_URL`: Your Azure Key Vault URL
- `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI endpoint
- `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key
- `COSMOS_DB_CONNECTION_STRING`: Your Cosmos DB connection string

#### 3. Azure Functions Build Issues

**Rebuild Functions**:

```pwsh
# Clean and rebuild
npm run clean:dist
npm run functions:build

# Check built files
ls api/functions/
```

**Verify Function Configuration**:

- Ensure all functions have `authLevel: 'anonymous'`
- Remove any `route` properties (not supported in SWA)
- Check `host.json` configuration

#### 4. Key Vault Access Issues

**Check Managed Identity**:

```pwsh
# Verify managed identity is enabled
az staticwebapp identity show -n $staticWebAppName -g $resourceGroup

# Grant Key Vault access
$principalId = az staticwebapp identity show -n $staticWebAppName -g $resourceGroup --query "principalId" -o tsv
az keyvault set-policy --name $keyVaultName --object-id $principalId --secret-permissions get list
```

#### 5. CORS Issues

**Update CORS Settings**:

```pwsh
# Update staticwebapp.config.json
# Ensure API routes allow anonymous access:
{
  "routes": [
    {
      "route": "/api/*",
      "allowedRoles": ["anonymous"]
    }
  ]
}
```

### Diagnostic Tools

#### Health Check Script

Run the comprehensive health check:

```pwsh
.\scripts\production-health-check.ps1
```

#### Azure Diagnostics

```pwsh
# Run Azure SWA diagnostics
.\scripts\azure-swa-diagnostic.ps1 -ResourceGroupName $resourceGroup -StaticWebAppName $staticWebAppName

# Check deployment logs
az staticwebapp show -n $staticWebAppName -g $resourceGroup --query "deployments"
```

#### Local vs Production Comparison

```pwsh
# Test local functions
func start

# Test specific endpoints locally
curl http://localhost:7071/api/health
curl -X POST http://localhost:7071/api/get-secret -H "Content-Type: application/json" -d '{"secretName": "test"}'

# Compare with production
curl https://your-app.azurestaticapps.net/api/health
```

### Performance Optimization

For better performance:

1. **Enable Azure CDN** for your Static Web App
2. **Configure Function App scaling** based on your expected load
3. **Use Premium Functions** for better cold start performance
4. **Optimize bundle size** by code splitting
5. **Enable compression** in `staticwebapp.config.json`

### Monitoring and Logging

#### Application Insights

```pwsh
# Enable Application Insights
az monitor app-insights component create --app $staticWebAppName-insights --location $location --resource-group $resourceGroup

# Link to Static Web App
az staticwebapp appsettings set -n $staticWebAppName -g $resourceGroup --setting-names APPLICATIONINSIGHTS_CONNECTION_STRING="your-connection-string"
```

#### Log Analysis

```pwsh
# Query logs using Azure CLI
az monitor app-insights query --app $staticWebAppName-insights --analytics-query "requests | where timestamp > ago(1h)"
```
