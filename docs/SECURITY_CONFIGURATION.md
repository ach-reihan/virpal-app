# VirPal App - Security Configuration Guidelines

## Azure Static Web Apps + Azure Functions Security Implementation

### 🔐 Environment Variables Security

#### Required Backend Environment Variables (Azure Functions)

```bash
# Azure Entra External ID (CIAM) - REQUIRED for JWT validation
AZURE_TENANT_NAME=your-tenant-name
AZURE_TENANT_ID=your-tenant-id-guid
AZURE_BACKEND_CLIENT_ID=your-backend-client-id-guid
AZURE_USER_FLOW=your-user-flow-name  # Optional

# Azure OpenAI Service - Production secrets
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini  # Optional, has default
AZURE_OPENAI_API_VERSION=2024-10-24       # Optional, has default

# Azure Speech Service - Production secrets
AZURE_SPEECH_SERVICE_KEY=your-speech-service-key
AZURE_SPEECH_SERVICE_REGION=your-speech-region
AZURE_SPEECH_SERVICE_ENDPOINT=https://your-region.api.cognitive.microsoft.com/

# Azure Cosmos DB - Production secrets
AZURE_COSMOS_DB_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
AZURE_COSMOS_DB_KEY=your-cosmos-key
AZURE_COSMOS_DB_CONNECTION_STRING=AccountEndpoint=...  # Alternative to endpoint+key
AZURE_COSMOS_DB_DATABASE_NAME=virpal-db                # Optional, has default

# Azure Key Vault - Optional fallback
KEY_VAULT_URL=https://your-keyvault.vault.azure.net/
```

#### Frontend Environment Variables (Static Web Apps)

```bash
# Azure Functions endpoints
VITE_AZURE_FUNCTION_ENDPOINT=https://your-function-app.azurewebsites.net/api/chat-completion
VITE_AZURE_FUNCTION_URL=https://your-function-app.azurewebsites.net
VITE_AZURE_FUNCTION_ENDPOINT2=https://your-function-app.azurewebsites.net/api/get-secrets

# Azure Entra External ID (CIAM) - Frontend config
VITE_MSAL_CLIENT_ID=your-frontend-client-id
VITE_TENANT_NAME=your-tenant-name
VITE_USER_FLOW_NAME=your-user-flow-name
VITE_BACKEND_SCOPE=api://your-backend-client-id/scope-name
```

### 🛡️ Security Features Implemented

#### 1. Authentication & Authorization

- **JWT Token Validation**: Comprehensive JWKS-based validation
- **Azure Entra External ID Integration**: CIAM authentication
- **Guest Mode Support**: Secure anonymous access for basic features
- **Development Mode Bypass**: Safe local development without authentication

#### 2. Input Validation & Sanitization

- **Request Body Validation**: Comprehensive input checking
- **XSS Prevention**: Basic script tag detection and blocking
- **Content Length Limits**: Prevents DoS attacks via large payloads
- **Parameter Sanitization**: SQL injection and path traversal prevention
- **Type Validation**: Strict type checking for all inputs

#### 3. Rate Limiting

- **Per-IP Rate Limiting**: 30 requests/minute for chat, 50/minute for secrets
- **Development Bypass**: Localhost requests excluded in dev mode
- **IP Validation**: Basic IP address format validation
- **Audit Logging**: Rate limit violations are logged for monitoring

#### 4. CORS Security

- **Strict Origin Validation**: Only whitelisted origins allowed
- **HTTPS Enforcement**: Production origins must use HTTPS
- **Method Restrictions**: Only required HTTP methods allowed
- **Credential Support**: Secure credential handling for authenticated requests

#### 5. Security Headers

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Access-Control-Max-Age: 3600
```

#### 6. Error Handling

- **Generic Error Messages**: No sensitive information in responses
- **Request ID Tracking**: UUID-based tracking for audit
- **Structured Logging**: Consistent logging patterns
- **Development vs Production**: Different error verbosity levels

### 🚀 Deployment Security Checklist

#### Pre-Deployment

- [ ] All production environment variables configured
- [ ] No hardcoded secrets in codebase
- [ ] CORS origins updated for production domain
- [ ] Rate limiting appropriate for expected load
- [ ] Security headers tested and working

#### Azure Configuration

- [ ] Azure Static Web Apps configured with proper authentication
- [ ] Azure Functions using Managed Identity where possible
- [ ] Azure Key Vault properly configured with RBAC
- [ ] Network security groups configured (if applicable)
- [ ] Azure Application Insights enabled for monitoring

#### Post-Deployment Verification

- [ ] Authentication flow working correctly
- [ ] API endpoints responding with correct CORS headers
- [ ] Rate limiting functioning as expected
- [ ] Error responses don't leak sensitive information
- [ ] Monitoring and alerting configured

### 🔧 Security Monitoring

#### Log Analysis Patterns

```bash
# Rate limiting violations
grep "rate limit exceeded" /var/log/functions/*.log

# Authentication failures
grep "authentication failed" /var/log/functions/*.log

# Suspicious request patterns
grep -E "(script|<|>|javascript)" /var/log/functions/*.log

# IP-based monitoring
grep -o -E '([0-9]{1,3}\.){3}[0-9]{1,3}' /var/log/functions/*.log | sort | uniq -c | sort -nr
```

#### Azure Monitor Queries

```kusto
// Authentication failures
FunctionAppLogs
| where Message contains "authentication failed"
| summarize count() by bin(TimeGenerated, 1h), ClientIP

// Rate limiting
FunctionAppLogs
| where Message contains "rate limit"
| summarize count() by bin(TimeGenerated, 5m), ClientIP

// Error patterns
FunctionAppLogs
| where LogLevel == "Error"
| summarize count() by bin(TimeGenerated, 1h), OperationName
```

### 🆘 Incident Response

#### Security Incident Types

1. **Authentication Bypass**: Immediate token revocation and investigation
2. **Rate Limit Abuse**: IP blocking and pattern analysis
3. **Data Exposure**: Audit logs and affected user notification
4. **Service Abuse**: Resource scaling and traffic analysis

#### Emergency Contacts

- **Primary**: reihan3000@gmail.com
- **Azure Support**: Via Azure Portal support tickets
- **Escalation**: Document all incidents for future prevention

#### Recovery Procedures

1. **Immediate**: Stop traffic to affected endpoints
2. **Analysis**: Review logs and identify attack vectors
3. **Mitigation**: Apply security patches and configuration changes
4. **Recovery**: Gradual traffic restoration with monitoring
5. **Post-Incident**: Security review and improvement implementation

### 📚 Security Documentation

- `SECURITY_AUDIT_REPORT.md` - Detailed security audit results
- `AZURE_SERVICES_COMPLETE_SETUP_GUIDE.md` - Azure security configuration
- `KEY_VAULT_SETUP_GUIDE.md` - Secure secret management
- `PRODUCTION_DEPLOYMENT_GUIDE.md` - Secure deployment procedures

---

**Security Framework**: OWASP Top 10 + Azure Security Best Practices
**Compliance**: Azure Security Benchmark + Microsoft Security Development Lifecycle
**Last Updated**: June 15, 2025
