# Test API with Authentication
# This script tests API endpoints using Microsoft Entra External ID authentication

Write-Host "🔐 Testing API with Authentication" -ForegroundColor Cyan

# Production URL
$ProductionUrl = "https://ashy-coast-0aeebe10f.6.azurestaticapps.net"

Write-Host "`n📋 Authentication Options:" -ForegroundColor Yellow
Write-Host "1. Test without authentication (current behavior)" -ForegroundColor Gray
Write-Host "2. Test with mock JWT token" -ForegroundColor Gray  
Write-Host "3. Get token from frontend (recommended)" -ForegroundColor Green

$choice = Read-Host "`nChoose option (1-3)"

switch ($choice) {
    "1" {
        Write-Host "`n🔍 Testing without authentication..." -ForegroundColor Yellow
        
        # Test get-secret with GET (correct method)
        Write-Host "`nTesting get-secret with GET method:"
        try {
            $response = Invoke-WebRequest -Uri "$ProductionUrl/api/get-secret?secretName=test" -Method GET
            Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
            Write-Host "📄 Response: $($response.Content)" -ForegroundColor Gray
        }
        catch {
            Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }

        # Test chat-completion with POST
        Write-Host "`nTesting chat-completion with POST method:"
        try {
            $body = @{
                userInput = "Hello"
                maxTokens = 10
            } | ConvertTo-Json
            
            $response = Invoke-WebRequest -Uri "$ProductionUrl/api/chat-completion" -Method POST -Body $body -ContentType "application/json"
            Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
            Write-Host "📄 Response: $($response.Content)" -ForegroundColor Gray
        }
        catch {
            Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    "2" {
        Write-Host "`n🎭 Testing with mock JWT token..." -ForegroundColor Yellow
        Write-Host "⚠️  Note: This will fail because it's not a real token from your Entra ID" -ForegroundColor Yellow
        
        # Mock JWT token (will fail validation)
        $mockToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIiwiaWF0IjoxNzM0MTY0NDAwLCJleHAiOjE3MzQxNjgwMDB9.mock-signature"
        
        # Test get-secret with mock token
        Write-Host "`nTesting get-secret with mock Authorization header:"
        try {
            $headers = @{
                "Authorization" = "Bearer $mockToken"
                "Content-Type" = "application/json"
            }
            
            $response = Invoke-WebRequest -Uri "$ProductionUrl/api/get-secret?secretName=test" -Method GET -Headers $headers
            Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
            Write-Host "📄 Response: $($response.Content)" -ForegroundColor Gray
        }
        catch {
            Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host "   (Expected - mock token will be rejected)" -ForegroundColor Gray
        }
    }
    
    "3" {
        Write-Host "`n🌐 Getting token from frontend..." -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Steps to get authenticated token:" -ForegroundColor Cyan
        Write-Host "1. Open your frontend: $ProductionUrl" -ForegroundColor Yellow
        Write-Host "2. Login using the authentication system" -ForegroundColor Yellow
        Write-Host "3. Open browser Developer Tools (F12)" -ForegroundColor Yellow
        Write-Host "4. Go to Console tab" -ForegroundColor Yellow
        Write-Host "5. Run this JavaScript code:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   // Get access token" -ForegroundColor Green
        Write-Host "   window.authService.getAccessToken().then(token => {" -ForegroundColor Green
        Write-Host "     console.log('Token:', token);" -ForegroundColor Green
        Write-Host "     localStorage.setItem('debug_token', token);" -ForegroundColor Green
        Write-Host "   });" -ForegroundColor Green
        Write-Host ""
        Write-Host "6. Copy the token from console" -ForegroundColor Yellow
        Write-Host "7. Come back here and paste it when prompted" -ForegroundColor Yellow
        Write-Host ""
        
        $token = Read-Host "Paste your authentication token here (or press Enter to skip)"
        
        if ($token -and $token.Length -gt 50) {
            Write-Host "`n🔐 Testing with your authentication token..." -ForegroundColor Green
            
            # Test get-secret with real token
            Write-Host "`nTesting get-secret with Authorization header:"
            try {
                $headers = @{
                    "Authorization" = "Bearer $token"
                    "Content-Type" = "application/json"
                }
                
                $response = Invoke-WebRequest -Uri "$ProductionUrl/api/get-secret?secretName=azure-speech-service-key" -Method GET -Headers $headers
                Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
                Write-Host "📄 Response: $($response.Content)" -ForegroundColor Gray
            }
            catch {
                Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
            }
            
            # Test chat-completion with real token
            Write-Host "`nTesting chat-completion with Authorization header:"
            try {
                $headers = @{
                    "Authorization" = "Bearer $token"
                    "Content-Type" = "application/json"
                }
                
                $body = @{
                    userInput = "Hello, this is a test message"
                    maxTokens = 50
                } | ConvertTo-Json
                
                $response = Invoke-WebRequest -Uri "$ProductionUrl/api/chat-completion" -Method POST -Body $body -Headers $headers
                Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
                Write-Host "📄 Response: $($response.Content)" -ForegroundColor Gray
            }
            catch {
                Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ No valid token provided. Token should be a long string (JWT format)." -ForegroundColor Red
        }
    }
    
    default {
        Write-Host "❌ Invalid option selected." -ForegroundColor Red
    }
}

Write-Host "`n💡 Authentication Requirements:" -ForegroundColor Yellow
Write-Host "• API endpoints require valid JWT token from Microsoft Entra External ID" -ForegroundColor Gray
Write-Host "• Token must be passed in Authorization header: Bearer <token>" -ForegroundColor Gray  
Write-Host "• Frontend handles authentication automatically when user is logged in" -ForegroundColor Gray
Write-Host "• For testing, get token from authenticated frontend session" -ForegroundColor Gray

Write-Host "`n✨ Testing complete!" -ForegroundColor Green
