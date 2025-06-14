targetScope = 'resourceGroup'

@description('Name of the environment')
param environmentName string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Name of the resource group')
param resourceGroupName string

@description('Azure tenant ID')
param azureTenantId string = tenant().tenantId

// Generate resource token for consistency with AZD expectations
var resourceToken = uniqueString(subscription().id, resourceGroup().id, environmentName)

// Update current resource group tags to include azd-env-name
resource resourceGroupTags 'Microsoft.Resources/tags@2024-03-01' = {
  name: 'default'
  properties: {
    tags: {
      'azd-env-name': environmentName
    }
  }
}

// Use existing VirPal resources - menggunakan resource yang sudah ada
var existingKeyVaultName = 'virpal-key-vault'
var existingKeyVaultResourceGroup = 'azure-key-vault-ai-assistant-virpal'
var existingCosmosDbName = 'project-ai-assistant-virpal-cosmos-db-nosql'
var existingCosmosDbResourceGroup = 'azure-cosmos-db-nosql-ai-assistant-virpal'
var existingSpeechServiceName = 'project-ai-assistant-virpal-speech-service'
var existingSpeechServiceResourceGroup = 'azure-speech-service-ai-assistant-virpal'
var existingOpenAIName = 'reiha-matmpsh6-eastus2'
var existingOpenAIResourceGroup = 'azure-openai-service-ai-assistant-virpal'
var existingStaticWebAppName = 'virpal-app'
var existingStaticWebAppResourceGroup = 'virpal-rg'
// Production Function App dan Application Insights akan dibuat baru
// Production resource group untuk resources baru
var productionResourceGroup = 'rg-virpal-prod'

// Reference existing VirPal resources
resource existingKeyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: existingKeyVaultName
  scope: resourceGroup(existingKeyVaultResourceGroup)
}

resource existingCosmosDb 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: existingCosmosDbName
  scope: resourceGroup(existingCosmosDbResourceGroup)
}

resource existingSpeechService 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: existingSpeechServiceName
  scope: resourceGroup(existingSpeechServiceResourceGroup)
}

resource existingOpenAI 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: existingOpenAIName
  scope: resourceGroup(existingOpenAIResourceGroup)
}

resource existingStaticWebApp 'Microsoft.Web/staticSites@2024-04-01' existing = {
  name: existingStaticWebAppName
  scope: resourceGroup(existingStaticWebAppResourceGroup)
}

// Reference production managed identity (yang sudah ada di rg-virpal-prod)
resource productionManagedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: 'id-gzvjkr7otps2w'
  scope: resourceGroup(productionResourceGroup)
}

// Grant Key Vault access to managed identity
module keyVaultAccess 'core/security/keyvault-access.bicep' = {
  name: 'keyvault-access'
  scope: subscription()
  params: {
    keyVaultName: existingKeyVaultName
    keyVaultResourceGroup: existingKeyVaultResourceGroup
    principalId: productionManagedIdentity.properties.principalId
  }
}

// Deploy new production Function App for Azure Static Web Apps
module productionFunctionApp 'core/host/functionapp-production.bicep' = {
  name: 'production-functionapp'
  scope: resourceGroup(productionResourceGroup)
  params: {
    functionAppName: 'virpal-production-func'
    location: location
    functionAppSku: 'Y1'
    storageAccountName: 'virpalprod'
    applicationInsightsInstrumentationKey: 'dummy-key' // Will be created in the module
    managedIdentityPrincipalId: productionManagedIdentity.properties.principalId
    userAssignedIdentityId: productionManagedIdentity.id
    keyVaultUrl: existingKeyVault.properties.vaultUri
    environmentName: environmentName
    tags: {
      'azd-env-name': environmentName
      project: 'virpal-app'
      environment: 'production'
      purpose: 'ai-assistant'
    }
  }
}

// Assign Storage permissions to managed identity
module storageRoleAssignments 'core/security/storage-role-assignments.bicep' = {
  name: 'storage-role-assignments'
  scope: resourceGroup(productionResourceGroup)
  params: {
    principalId: productionManagedIdentity.properties.principalId
    storageAccountId: productionFunctionApp.outputs.storageAccountId
  }
}

// Assign Monitoring permissions to managed identity
module monitoringRoleAssignment 'core/security/monitoring-role-assignment.bicep' = {
  name: 'monitoring-role-assignment-${uniqueString(deployment().name)}'
  scope: subscription()
  params: {
    principalId: productionManagedIdentity.properties.principalId
  }
}

// Output
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = azureTenantId
output AZURE_RESOURCE_GROUP string = resourceGroupName
output AZURE_ENV_NAME string = environmentName
output RESOURCE_GROUP_ID string = resourceGroup().id
output resourceToken string = resourceToken

output AZURE_KEY_VAULT_ENDPOINT string = existingKeyVault.properties.vaultUri
output AZURE_KEY_VAULT_NAME string = existingKeyVaultName

output AZURE_OPENAI_ENDPOINT string = existingOpenAI.properties.endpoint
output AZURE_SPEECH_SERVICE_ENDPOINT string = existingSpeechService.properties.endpoint
output AZURE_COSMOS_DB_ENDPOINT string = existingCosmosDb.properties.documentEndpoint

output AZURE_PRODUCTION_FUNCTION_APP_NAME string = productionFunctionApp.outputs.functionAppName
output AZURE_PRODUCTION_FUNCTION_APP_URL string = productionFunctionApp.outputs.functionAppUrl

output AZURE_STATIC_WEB_APP_NAME string = existingStaticWebApp.name
output AZURE_STATIC_WEB_APP_URL string = existingStaticWebApp.properties.defaultHostname != null ? existingStaticWebApp.properties.defaultHostname : 'Not available'
