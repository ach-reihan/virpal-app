targetScope = 'resourceGroup'

@description('Name of the environment')
param environmentName string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Name of the resource group')
param resourceGroupName string

@description('Azure tenant ID')
param azureTenantId string = tenant().tenantId

@description('Azure client ID for service principal')
param azureClientId string = ''

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

// Use existing resources
var existingKeyVaultName = 'virpal-key-vault'
var existingKeyVaultResourceGroup = 'azure-key-vault-ai-assistant-virpal'
var existingFunctionAppName = 'project-ai-assistant-virpal-function-app'
var existingFunctionAppResourceGroup = 'azure-function-app-ai-assistant-virpal'
var existingCosmosDbName = 'project-ai-assistant-virpal-cosmos-db-nosql'
var existingCosmosDbResourceGroup = 'azure-cosmos-db-nosql-ai-assistant-virpal'
var existingSpeechServiceName = 'project-ai-assistant-virpal-speech-service'
var existingSpeechServiceResourceGroup = 'azure-speech-service-ai-assistant-virpal'
var existingManagedIdentityName = 'project-ai-assistant-virpal-managed-identity'
var existingManagedIdentityResourceGroup = 'azure-managed-identity-ai-assistant-virpal'
var existingOpenAIName = 'cog-gxjeppic5fc3a'
var existingOpenAIResourceGroup = 'azure-function-app-ai-assistant-virpal'
var existingStaticWebAppName = 'virpal-app'
var existingStaticWebAppResourceGroup = 'virpal-rg'

// Reference existing resources
resource existingKeyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: existingKeyVaultName
  scope: resourceGroup(existingKeyVaultResourceGroup)
}

resource existingFunctionApp 'Microsoft.Web/sites@2024-04-01' existing = {
  name: existingFunctionAppName
  scope: resourceGroup(existingFunctionAppResourceGroup)
}

resource existingCosmosDb 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: existingCosmosDbName
  scope: resourceGroup(existingCosmosDbResourceGroup)
}

resource existingSpeechService 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: existingSpeechServiceName
  scope: resourceGroup(existingSpeechServiceResourceGroup)
}

resource existingManagedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: existingManagedIdentityName
  scope: resourceGroup(existingManagedIdentityResourceGroup)
}

resource existingOpenAI 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: existingOpenAIName
  scope: resourceGroup(existingOpenAIResourceGroup)
}

resource existingStaticWebApp 'Microsoft.Web/staticSites@2024-04-01' existing = {
  name: existingStaticWebAppName
  scope: resourceGroup(existingStaticWebAppResourceGroup)
}

// Grant Key Vault access to managed identity
module keyVaultAccess 'core/security/keyvault-access.bicep' = {
  name: 'keyvault-access'
  scope: subscription()
  params: {
    keyVaultName: existingKeyVaultName
    keyVaultResourceGroup: existingKeyVaultResourceGroup
    principalId: existingManagedIdentity.properties.principalId
  }
}

// Update Function App settings to use existing resources
module updateFunctionAppSettings 'core/host/update-functionapp-settings.bicep' = {
  name: 'update-functionapp-settings'
  scope: resourceGroup(existingFunctionAppResourceGroup)
  params: {
    functionAppName: existingFunctionAppName
    appSettings: {
      FUNCTIONS_EXTENSION_VERSION: '~4'
      FUNCTIONS_WORKER_RUNTIME: 'node'
      NODE_ENV: 'production'
      WEBSITE_NODE_DEFAULT_VERSION: '~20'

      // Azure services
      AZURE_TENANT_ID: azureTenantId
      AZURE_CLIENT_ID: azureClientId

      // Key Vault
      KEY_VAULT_URL: existingKeyVault.properties.vaultUri

      // OpenAI
      AZURE_OPENAI_ENDPOINT: existingOpenAI.properties.endpoint
      AZURE_OPENAI_API_KEY: '@Microsoft.KeyVault(VaultName=${existingKeyVaultName};SecretName=azure-openai-key)'
      AZURE_OPENAI_DEPLOYMENT_NAME: 'gpt-4o-mini'
      AZURE_OPENAI_API_VERSION: '2024-10-24'

      // Speech Service
      AZURE_SPEECH_SERVICE_KEY: '@Microsoft.KeyVault(VaultName=${existingKeyVaultName};SecretName=azure-speech-service-key)'
      AZURE_SPEECH_SERVICE_REGION: 'southeastasia'
      AZURE_SPEECH_SERVICE_ENDPOINT: existingSpeechService.properties.endpoint

      // Cosmos DB
      COSMOS_DB_ENDPOINT: existingCosmosDb.properties.documentEndpoint
      COSMOS_DB_KEY: '@Microsoft.KeyVault(VaultName=${existingKeyVaultName};SecretName=azure-cosmos-db-key)'
      COSMOS_DB_DATABASE: 'virpal-db'
      COSMOS_DB_CONTAINER: 'conversations'
    }
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

output AZURE_FUNCTION_APP_NAME string = existingFunctionApp.name
output AZURE_FUNCTION_APP_URL string = 'https://${existingFunctionApp.properties.defaultHostName}'

output AZURE_STATIC_WEB_APP_NAME string = existingStaticWebApp.name
output AZURE_STATIC_WEB_APP_URL string = existingStaticWebApp.properties.defaultHostname != null ? existingStaticWebApp.properties.defaultHostname : 'Not available'
