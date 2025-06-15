/**
 * VirPal App - AI Assistant with Azure Functions
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * This file is part of VirPal App, a proprietary software application.
 *
 * PROPRIETARY AND CONFIDENTIAL
 *
 * This source code is the exclusive property of Achmad Reihan Alfaiz.
 * No part of this software may be reproduced, distributed, or transmitted
 * in any form or by any means, including photocopying, recording, or other
 * electronic or mechanical methods, without the prior written permission
 * of the copyright holder, except in the case of brief quotations embodied
 * in critical reviews and certain other noncommercial uses permitted by
 * copyright law.
 *
 * For licensing inquiries: reihan3000@gmail.com
 */
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
class JWTValidationService {
    constructor(config) {
        // Removed unused cache variable
        this.CACHE_DURATION = 60 * 60 * 1000; // 1 hour
        this.config = config;
        // Default JWKS URI untuk Azure CIAM
        const jwksUri = config.jwksUri ||
            `https://${config.tenantName}.ciamlogin.com/${config.tenantName}.onmicrosoft.com/${config.userFlow}/discovery/v2.0/keys`;
        this.jwksClient = jwksClient({
            jwksUri,
            requestHeaders: {}, // Optional
            timeout: 30000, // 30 seconds
            cache: true,
            cacheMaxEntries: 5,
            cacheMaxAge: this.CACHE_DURATION,
            rateLimit: true,
            jwksRequestsPerMinute: 5,
        });
    }
    /**
     * Get signing key dari JWKS endpoint dengan fallback mechanism
     */
    async getSigningKey(kid) {
        try {
            // Jika ada kid, coba gunakan kid tersebut
            if (kid) {
                try {
                    const key = await this.jwksClient.getSigningKey(kid);
                    return key.getPublicKey();
                }
                catch {
                    console.warn(`Failed to get key with kid ${kid}, trying fallback...`);
                }
            }
            // Fallback: coba tanpa kid - ambil key pertama yang tersedia
            // Untuk production, kita tidak terlalu bergantung pada kid
            const fallbackKey = await this.getFallbackSigningKey();
            if (fallbackKey) {
                return fallbackKey;
            }
            throw new Error('No signing keys available');
        }
        catch (error) {
            throw new Error(`Failed to get signing key: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get fallback signing key - ambil key pertama yang tersedia
     */
    async getFallbackSigningKey() {
        try {
            // Fetch JWKS untuk mendapatkan key pertama
            const jwksResponse = await fetch(`https://${this.config.tenantName}.ciamlogin.com/${this.config.tenantId}/discovery/v2.0/keys`);
            if (!jwksResponse.ok) {
                throw new Error(`JWKS fetch failed: ${jwksResponse.status}`);
            }
            const jwks = await jwksResponse.json();
            // Ambil key pertama yang valid untuk signing
            for (const key of jwks.keys || []) {
                if (key.kty === 'RSA' && key.use === 'sig' && key.kid) {
                    try {
                        // Gunakan jwksClient untuk mendapatkan key dengan kid ini
                        const signingKey = await this.jwksClient.getSigningKey(key.kid);
                        return signingKey.getPublicKey();
                    }
                    catch {
                        continue; // Coba key berikutnya
                    }
                }
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * Validate JWT token dengan fallback mechanism
     */
    async validateToken(token, context) {
        try {
            // Decode token untuk mendapatkan kid (optional)
            const decodedHeader = jwt.decode(token, { complete: true });
            const kid = decodedHeader?.header?.kid;
            // JWT verification options
            const verifyOptions = {
                algorithms: ['RS256'],
                audience: this.config.audience || this.config.clientId,
                // For CIAM tokens, issuer does not include user flow
                issuer: this.config.issuer ||
                    `https://${this.config.tenantId}.ciamlogin.com/${this.config.tenantId}/v2.0`,
                clockTolerance: 60, // 60 seconds tolerance for clock skew
            };
            let decoded = null;
            let lastError = null;
            // Coba mendapatkan signing key (dengan atau tanpa kid)
            try {
                const signingKey = await this.getSigningKey(kid);
                decoded = jwt.verify(token, signingKey, verifyOptions);
                context.info(`Token verified successfully ${kid ? `using kid: ${kid}` : 'with fallback key'}`);
            }
            catch (error) {
                lastError = error;
                context.error(`Token verification failed: ${lastError.message}`);
            }
            // Jika tidak berhasil
            if (!decoded) {
                const errorMessage = lastError?.message || 'Token validation failed';
                context.error('Token validation failed with all available methods');
                return {
                    isValid: false,
                    error: `Token validation failed: ${errorMessage}`,
                };
            }
            // Additional validation
            const validationResult = this.validateClaims(decoded, context);
            if (!validationResult.isValid) {
                return validationResult;
            }
            // Extract user info dan scopes
            const userId = decoded.sub;
            const scopes = decoded.scp ? decoded.scp.split(' ') : [];
            return {
                isValid: true,
                claims: decoded,
                userId,
                scopes,
            };
        }
        catch (error) {
            let errorMessage = 'Token validation failed';
            if (error instanceof jwt.TokenExpiredError) {
                errorMessage = 'Token has expired';
            }
            else if (error instanceof jwt.JsonWebTokenError) {
                errorMessage = 'Invalid token format';
            }
            else if (error instanceof jwt.NotBeforeError) {
                errorMessage = 'Token not active yet';
            }
            else {
                context.error('JWT validation error:', error instanceof Error ? error.message : 'Unknown error');
            }
            return {
                isValid: false,
                error: errorMessage,
            };
        }
    }
    /**
     * Validate token claims
     */ validateClaims(claims, context) {
        // Check required claims
        if (!claims.sub) {
            return {
                isValid: false,
                error: 'Missing user identifier in token',
            };
        }
        // For CIAM tokens, validate against the frontend client ID (audience)
        const expectedAudience = this.config.audience || this.config.clientId;
        if (!claims.aud ||
            (Array.isArray(claims.aud)
                ? !claims.aud.includes(expectedAudience)
                : claims.aud !== expectedAudience)) {
            context.warn(`Token audience mismatch. Expected: ${expectedAudience}, Got: ${claims.aud}`);
            return {
                isValid: false,
                error: 'Token audience mismatch',
            };
        }
        // Check token expiry (additional check, jwt.verify already handles this)
        const now = Math.floor(Date.now() / 1000);
        if (claims.exp && claims.exp < now) {
            return {
                isValid: false,
                error: 'Token has expired',
            };
        }
        // Check not before (nbf) claim
        if (claims.nbf && claims.nbf > now) {
            return {
                isValid: false,
                error: 'Token not yet valid',
            };
        } // Validate issuer format (updated for CIAM)
        const expectedIssuer = `https://${this.config.tenantId}.ciamlogin.com/${this.config.tenantId}/v2.0`;
        if (claims.iss !== expectedIssuer) {
            context.warn(`Invalid token issuer: ${claims.iss}, expected: ${expectedIssuer}`);
            return {
                isValid: false,
                error: 'Invalid token issuer',
            };
        }
        // For CIAM: Validate that token contains required scope for API access
        const requiredScope = 'Virpal.ReadWrite'; // CIAM scope for this API
        if (!this.hasScope(claims, requiredScope)) {
            context.warn(`Token missing required scope: ${requiredScope}. Available: ${claims.scp}`);
            return {
                isValid: false,
                error: `Missing required permission: ${requiredScope}`,
            };
        }
        return { isValid: true };
    }
    /**
     * Extract user information dari token claims
     */ extractUserInfo(claims) {
        return {
            userId: claims.sub,
            email: claims.email,
            name: claims.name,
            givenName: claims.given_name,
            familyName: claims.family_name,
        };
    }
    /**
     * Check if user has required scope
     */
    hasScope(claims, requiredScope) {
        if (!claims.scp)
            return false;
        const scopes = claims.scp.split(' ');
        return scopes.includes(requiredScope);
    }
    /**
     * Get token info untuk debugging
     */
    getTokenInfo(token) {
        try {
            const decoded = jwt.decode(token, { complete: true });
            if (!decoded)
                return {};
            const payload = decoded.payload;
            const isExpired = payload.exp
                ? payload.exp < Math.floor(Date.now() / 1000)
                : false;
            return {
                header: decoded.header,
                payload: decoded.payload,
                isExpired,
            };
        }
        catch {
            return {};
        }
    }
}
/**
 * Create JWT validation service dengan configuration dari environment variables
 */
export function createJWTService() {
    const config = {
        tenantName: process.env['AZURE_TENANT_NAME'] || 'virpalapp',
        tenantId: process.env['AZURE_TENANT_ID'] || 'db0374b9-bb6f-4410-ad04-db7fe70f4d7b',
        clientId: process.env['AZURE_BACKEND_CLIENT_ID'] ||
            '9ae4699e-0823-453e-b0f7-b614491a80a2',
        userFlow: process.env['AZURE_USER_FLOW'] || '',
        // Use CIAM endpoints without user flow (External ID uses different format)
        jwksUri: `https://${process.env['AZURE_TENANT_NAME'] || 'virpalapp'}.ciamlogin.com/${process.env['AZURE_TENANT_ID'] || 'db0374b9-bb6f-4410-ad04-db7fe70f4d7b'}/discovery/v2.0/keys`,
        // Issuer for CIAM (External ID) tokens - no user flow
        issuer: `https://${process.env['AZURE_TENANT_ID'] || 'db0374b9-bb6f-4410-ad04-db7fe70f4d7b'}.ciamlogin.com/${process.env['AZURE_TENANT_ID'] || 'db0374b9-bb6f-4410-ad04-db7fe70f4d7b'}/v2.0`,
        // For CIAM, audience should be the backend API client ID
        audience: process.env['AZURE_BACKEND_CLIENT_ID'] ||
            '9ae4699e-0823-453e-b0f7-b614491a80a2',
    };
    // Validate configuration
    const requiredFields = ['tenantName', 'tenantId', 'clientId'];
    for (const field of requiredFields) {
        if (!config[field]) {
            throw new Error(`Missing required JWT configuration: ${field}`);
        }
    }
    return new JWTValidationService(config);
}
export { JWTValidationService };
export default createJWTService;
//# sourceMappingURL=jwtValidationService.js.map