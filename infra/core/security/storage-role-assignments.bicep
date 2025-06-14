@description('Principal ID of the managed identity')
param principalId string

@description('Storage account resource ID')
param storageAccountId string

// Define role definition IDs for storage access
var roles = {
  StorageBlobDataOwner: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  StorageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  StorageQueueDataContributor: '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
  StorageTableDataContributor: '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
}

// Reference existing storage account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: last(split(storageAccountId, '/'))
}

// Assign Storage Blob Data Owner role
resource blobDataOwnerRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(principalId, roles.StorageBlobDataOwner, storageAccountId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.StorageBlobDataOwner)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Storage Blob Data Contributor role
resource blobDataContributorRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(principalId, roles.StorageBlobDataContributor, storageAccountId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.StorageBlobDataContributor)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Storage Queue Data Contributor role
resource queueDataContributorRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(principalId, roles.StorageQueueDataContributor, storageAccountId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.StorageQueueDataContributor)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Assign Storage Table Data Contributor role
resource tableDataContributorRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(principalId, roles.StorageTableDataContributor, storageAccountId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.StorageTableDataContributor)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

// Output role assignment details
output roleAssignments array = [
  {
    roleDefinitionId: roles.StorageBlobDataOwner
    scope: storageAccountId
    principalType: 'ServicePrincipal'
  }
  {
    roleDefinitionId: roles.StorageBlobDataContributor
    scope: storageAccountId
    principalType: 'ServicePrincipal'
  }
  {
    roleDefinitionId: roles.StorageQueueDataContributor
    scope: storageAccountId
    principalType: 'ServicePrincipal'
  }
  {
    roleDefinitionId: roles.StorageTableDataContributor
    scope: storageAccountId
    principalType: 'ServicePrincipal'
  }
]
