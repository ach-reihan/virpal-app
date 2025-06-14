targetScope = 'resourceGroup'

@description('The name of the existing Function App')
param functionAppName string

@description('Environment settings for the Function App')
param appSettings object

// Reference existing Function App
resource existingFunctionApp 'Microsoft.Web/sites@2024-04-01' existing = {
  name: functionAppName
}

// Update Function App settings
resource functionAppSettings 'Microsoft.Web/sites/config@2024-04-01' = {
  name: 'appsettings'
  parent: existingFunctionApp
  properties: appSettings
}

// Configure slot settings to ensure all environment variables are treated as slot settings
// This prevents production values from being overwritten during slot swaps
resource slotConfigNames 'Microsoft.Web/sites/config@2024-04-01' = {
  name: 'slotConfigNames'
  parent: existingFunctionApp
  properties: {
    appSettingNames: [
      'AZURE_CLIENT_ID'
      'AZURE_TENANT_ID'
      'AZURE_KEY_VAULT_ENDPOINT'
      'AZURE_OPENAI_ENDPOINT'
      'AZURE_OPENAI_API_VERSION'
      'AZURE_SPEECH_KEY'
      'AZURE_SPEECH_REGION'
      'COSMOS_DB_ENDPOINT'
      'COSMOS_DB_DATABASE_NAME'
      'COSMOS_DB_CONTAINER_NAME'
      'APPLICATIONINSIGHTS_CONNECTION_STRING'
      'AzureWebJobsStorage'
      'FUNCTIONS_EXTENSION_VERSION'
      'FUNCTIONS_WORKER_RUNTIME'
      'WEBSITE_NODE_DEFAULT_VERSION'
      'NODE_ENV'
      'SCM_DO_BUILD_DURING_DEPLOYMENT'
      'ENABLE_ORYX_BUILD'
      'WEBSITE_RUN_FROM_PACKAGE'
    ]
  }
  dependsOn: [
    functionAppSettings
  ]
}
