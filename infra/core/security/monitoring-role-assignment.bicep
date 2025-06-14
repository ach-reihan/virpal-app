targetScope = 'subscription'

@description('Principal ID of the managed identity')
param principalId string

// Define Monitoring Metrics Publisher role
var monitoringMetricsPublisherRole = '3913510d-42f4-4e42-8a64-420c390055eb'

// Assign Monitoring Metrics Publisher role at subscription level
resource monitoringMetricsPublisherRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(principalId, monitoringMetricsPublisherRole, subscription().id)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', monitoringMetricsPublisherRole)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output roleAssignment object = {
  roleDefinitionId: monitoringMetricsPublisherRole
  scope: subscription().id
  principalType: 'ServicePrincipal'
}
