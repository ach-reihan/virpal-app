@description('Name of the Function App')
param functionAppName string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('App Service Plan SKU for Function App')
@allowed(['B1', 'B2', 'B3', 'S1', 'S2', 'S3', 'P1v2', 'P2v2', 'P3v2', 'P1v3', 'P2v3', 'P3v3', 'Y1'])
param functionAppSku string = 'Y1'

@description('Storage Account name for Function App')
param storageAccountName string

@description('Application Insights workspace ID')
param applicationInsightsInstrumentationKey string

@description('Managed Identity principal ID')
param managedIdentityPrincipalId string

@description('User-assigned Managed Identity resource ID')
param userAssignedIdentityId string

@description('Key Vault URL for secure settings')
param keyVaultUrl string

@description('Tags to be applied to resources')
param tags object = {}

@description('Environment name for azd compatibility')
param environmentName string

// Generate unique names with resource token for consistency
var resourceToken = uniqueString(subscription().id, resourceGroup().id, environmentName)
var uniqueFunctionAppName = '${functionAppName}-${resourceToken}'
var uniqueStorageAccountName = '${storageAccountName}${resourceToken}'
var appServicePlanName = 'asp-${uniqueFunctionAppName}'

// Create storage account for Function App
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: uniqueStorageAccountName
  location: location
  tags: union(tags, {
    'azd-service-name': 'functionapp'
    'azd-env-name': environmentName
  })
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    defaultToOAuthAuthentication: false
    networkAcls: {
      defaultAction: 'Allow'
    }
    encryption: {
      services: {
        file: {
          keyType: 'Account'
          enabled: true
        }
        blob: {
          keyType: 'Account'
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// Create App Service Plan for Function App
resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appServicePlanName
  location: location
  tags: union(tags, {
    'azd-service-name': 'functionapp'
    'azd-env-name': environmentName
  })
  sku: {
    name: functionAppSku
    tier: functionAppSku == 'Y1' ? 'Dynamic' : 'Standard'
  }
  kind: 'functionapp'
  properties: {
    reserved: false // Windows Function App
  }
}

// Create Function App
resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: uniqueFunctionAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'functionapp'
    'azd-env-name': environmentName
  })
  kind: 'functionapp'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentityId}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    publicNetworkAccess: 'Enabled'
    keyVaultReferenceIdentity: userAssignedIdentityId

    siteConfig: {      // Function App v4 configuration
      appSettings: [
        // Azure Functions runtime configuration
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(uniqueFunctionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }

        // Monitoring and Application Insights
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: applicationInsightsInstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: 'InstrumentationKey=${applicationInsightsInstrumentationKey}'
        }

        // Azure Identity and Authentication
        {
          name: 'AZURE_CLIENT_ID'
          value: managedIdentityPrincipalId
        }
        {
          name: 'AZURE_TENANT_ID'
          value: tenant().tenantId
        }

        // Key Vault Configuration
        {
          name: 'KEY_VAULT_URL'
          value: keyVaultUrl
        }

        // Azure OpenAI Configuration (using Key Vault references)
        {
          name: 'AZURE_OPENAI_ENDPOINT'
          value: '@Microsoft.KeyVault(VaultName=${last(split(keyVaultUrl, '/'))};SecretName=azure-openai-endpoint)'
        }
        {
          name: 'AZURE_OPENAI_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${last(split(keyVaultUrl, '/'))};SecretName=azure-openai-key)'
        }
        {
          name: 'AZURE_OPENAI_DEPLOYMENT_NAME'
          value: 'gpt-4o-mini'
        }
        {
          name: 'AZURE_OPENAI_API_VERSION'
          value: '2024-10-24'
        }

        // Azure Speech Service Configuration (using Key Vault references)
        {
          name: 'AZURE_SPEECH_SERVICE_KEY'
          value: '@Microsoft.KeyVault(VaultName=${last(split(keyVaultUrl, '/'))};SecretName=azure-speech-service-key)'
        }
        {
          name: 'AZURE_SPEECH_SERVICE_REGION'
          value: 'southeastasia'
        }
        {
          name: 'AZURE_SPEECH_SERVICE_ENDPOINT'
          value: '@Microsoft.KeyVault(VaultName=${last(split(keyVaultUrl, '/'))};SecretName=azure-speech-service-endpoint)'
        }

        // Azure Cosmos DB Configuration (using Key Vault references)
        {
          name: 'COSMOS_DB_ENDPOINT'
          value: '@Microsoft.KeyVault(VaultName=${last(split(keyVaultUrl, '/'))};SecretName=azure-cosmos-db-endpoint)'
        }
        {
          name: 'COSMOS_DB_KEY'
          value: '@Microsoft.KeyVault(VaultName=${last(split(keyVaultUrl, '/'))};SecretName=azure-cosmos-db-key)'
        }
        {
          name: 'COSMOS_DB_DATABASE'
          value: 'virpal-db'
        }
        {
          name: 'COSMOS_DB_CONTAINER'
          value: 'conversations'
        }

        // Azure AD B2C / Entra External ID Configuration (for JWT validation)
        {
          name: 'AZURE_TENANT_NAME'
          value: '@Microsoft.KeyVault(VaultName=${last(split(keyVaultUrl, '/'))};SecretName=azure-tenant-name)'
        }
        {
          name: 'AZURE_BACKEND_CLIENT_ID'
          value: '@Microsoft.KeyVault(VaultName=${last(split(keyVaultUrl, '/'))};SecretName=azure-backend-client-id)'
        }
        {
          name: 'AZURE_FRONTEND_CLIENT_ID'
          value: '@Microsoft.KeyVault(VaultName=${last(split(keyVaultUrl, '/'))};SecretName=azure-frontend-client-id)'
        }
        {
          name: 'AZURE_USER_FLOW'
          value: '@Microsoft.KeyVault(VaultName=${last(split(keyVaultUrl, '/'))};SecretName=azure-user-flow)'
        }

        // Security and Performance Settings
        {
          name: 'WEBSITE_ENABLE_SYNC_UPDATE_SITE'
          value: 'true'
        }
        {
          name: 'WEBSITE_TIME_ZONE'
          value: 'Asia/Jakarta'
        }
      ]

      // CORS configuration for Azure Static Web Apps integration
      cors: {
        allowedOrigins: ['*']
        supportCredentials: false
      }

      // Security and performance settings
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      http20Enabled: true      // Function-specific configurations
      use32BitWorkerProcess: false

      // Health check path for monitoring
      healthCheckPath: '/api/health'
    }
  }
}

// Configure Function App logging
resource functionAppLogs 'Microsoft.Web/sites/config@2024-04-01' = {
  name: 'logs'
  parent: functionApp
  properties: {
    applicationLogs: {
      fileSystem: {
        level: 'Information'
      }
    }
    httpLogs: {
      fileSystem: {
        retentionInMb: 35
        retentionInDays: 7
        enabled: true
      }
    }
    failedRequestsTracing: {
      enabled: true
    }
    detailedErrorMessages: {
      enabled: true
    }
  }
}

// Create diagnostic settings for Function App
module diagnosticSettings '../monitor/diagnostic-settings.bicep' = {
  name: 'functionapp-diagnostics'
  params: {
    functionAppName: functionApp.name
    storageAccountId: storageAccount.id
  }
}

// Assign storage roles to managed identity
module storageRoleAssignments '../security/storage-role-assignments.bicep' = {
  name: 'storage-role-assignments'
  params: {
    principalId: managedIdentityPrincipalId
    storageAccountId: storageAccount.id
  }
}

// Assign monitoring role to managed identity (subscription scope)
module monitoringRoleAssignment '../security/monitoring-role-assignment.bicep' = {
  name: 'monitoring-role-assignment'
  scope: subscription()
  params: {
    principalId: managedIdentityPrincipalId
  }
}

// Output values for deployment and integration
output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output functionAppId string = functionApp.id
output functionAppPrincipalId string = managedIdentityPrincipalId
output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output appServicePlanId string = appServicePlan.id

// Resource identifiers for AZD compatibility
output resourceGroupId string = resourceGroup().id
output resourceToken string = resourceToken
