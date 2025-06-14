targetScope = 'subscription'

@description('Name of the Key Vault')
param keyVaultName string

@description('Resource group containing the Key Vault')
param keyVaultResourceGroup string

@description('Principal ID of the managed identity')
param principalId string

// Reference existing Key Vault in different resource group
resource existingKeyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
  scope: resourceGroup(keyVaultResourceGroup)
}

// Grant Key Vault Secrets User role to managed identity
resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(existingKeyVault.id, principalId, 'Key Vault Secrets User')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') // Key Vault Secrets User
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output roleAssignmentId string = keyVaultRoleAssignment.id
