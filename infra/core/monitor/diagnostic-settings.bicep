@description('Function App name')
param functionAppName string

@description('Log Analytics workspace resource ID')
param logAnalyticsWorkspaceId string = ''

@description('Storage account resource ID for diagnostic logs')
param storageAccountId string = ''

// Reference the existing Function App
resource functionApp 'Microsoft.Web/sites@2024-04-01' existing = {
  name: functionAppName
}

// Create diagnostic settings for Function App
resource diagnosticSettings 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'functionapp-diagnostics'
  scope: functionApp
  properties: {
    logs: [
      {
        category: 'FunctionAppLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
    // Use storage account if Log Analytics workspace is not provided
    storageAccountId: !empty(storageAccountId) ? storageAccountId : null
    workspaceId: !empty(logAnalyticsWorkspaceId) ? logAnalyticsWorkspaceId : null
  }
}
