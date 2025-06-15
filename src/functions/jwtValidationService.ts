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

/**
 * JWT Token Validation Service for Azure Functions
 *
 * Service untuk validasi JWT token dari Azure Entra External ID (B2C)
 * menggunakan JWKS (JSON Web Key Set) untuk verifikasi signature
 *
 * Features:
 * - JWT token validation dengan signature verification
 * - JWKS caching untuk performance
 * - Token claims extraction dan validation
 * - Audience dan issuer validation
 * - Error handling dan logging
 * - TypeScript type safety
 *
 * Best Practices Applied:
 * - Security validation (signature, expiry, audience)
 * - Performance optimization (JWKS caching)
 * - Comprehensive error handling
 * - Detailed logging untuk debugging
 * - Type safety dengan interfaces
 */

import type { JwtPayload } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
// Use jwks-rsa instead of jwks-client
import jwksClient from 'jwks-rsa';

/**
 * JWT Claims Interface untuk Azure B2C
 */
export interface B2CTokenClaims extends JwtPayload {
  /** User ID */
  sub: string;
  /** Issuer */
  iss: string;
  /** Audience */
  aud: string;
  /** Expiry time */
  exp: number;
  /** Issued at time */
  iat: number;
  /** Not before time */
  nbf?: number;
  /** Token ID */
  jti?: string;
  /** User flow version */
  tfp?: string;
  /** Scope */
  scp?: string;
  /** Application ID yang mengakses token */
  azp?: string;
  /** User email */
  email?: string;
  /** User display name */
  name?: string;
  /** User given name */
  given_name?: string;
  /** User family name */
  family_name?: string;
  /** Additional custom claims */
  [key: string]: unknown;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  isValid: boolean;
  claims?: B2CTokenClaims;
  error?: string;
  userId?: string;
  scopes?: string[];
}

/**
 * JWT Service Configuration
 */
interface JWTServiceConfig {
  tenantName: string;
  tenantId: string;
  clientId: string;
  userFlow: string;
  jwksUri?: string;
  issuer?: string;
  audience?: string;
}

// Removed unused JWKS Cache interface

// Add type for JwksClient
interface JwksClient {
  getSigningKey(kid: string): Promise<{ getPublicKey(): string }>;
}

class JWTValidationService {
  private config: JWTServiceConfig;
  private jwksClient: JwksClient;
  // Removed unused cache variable
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  constructor(config: JWTServiceConfig) {
    this.config = config;

    // Default JWKS URI untuk Azure CIAM
    const jwksUri =
      config.jwksUri ||
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
   * Get signing key dari JWKS endpoint
   */
  private async getSigningKey(kid: string): Promise<string> {
    try {
      const key = await this.jwksClient.getSigningKey(kid);
      return key.getPublicKey();
    } catch (error) {
      // Enhanced error handling with more context (only in development)
      const isDevelopment = process.env['NODE_ENV'] === 'development';
      if (isDevelopment) {
        console.error('JWKS signing key error details:', {
          kid,
          error: error instanceof Error ? error.message : 'Unknown error',
          jwksUri: `https://${this.config.tenantName}.ciamlogin.com/${this.config.tenantId}/discovery/v2.0/keys`,
        });
      }

      // Try alternative JWKS URI format if the first one fails
      if (
        error instanceof Error &&
        error.message.includes('Unable to find a signing key')
      ) {
        if (isDevelopment) {
          console.warn('Retrying with alternative JWKS URI format...');
        }

        // Create a new client with alternative URI format
        const alternativeJwksUri = `https://${this.config.tenantId}.ciamlogin.com/${this.config.tenantId}/discovery/v2.0/keys`;
        const alternativeClient = jwksClient({
          jwksUri: alternativeJwksUri,
          requestHeaders: {},
          timeout: 30000,
          cache: true,
          cacheMaxEntries: 5,
          cacheMaxAge: this.CACHE_DURATION,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
        });

        try {
          const alternativeKey = await alternativeClient.getSigningKey(kid);
          console.info('Successfully retrieved key with alternative URI');
          return alternativeKey.getPublicKey();
        } catch (alternativeError) {
          console.error('Alternative JWKS URI also failed:', alternativeError);
        }
      }

      throw new Error(
        `Failed to get signing key for kid: ${kid}. Please check JWKS endpoint configuration.`
      );
    }
  }
  /**
   * Validate JWT token
   */ async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Step 1: Decode token header to get kid without verification
      const decodedToken = jwt.decode(token, { complete: true });

      if (!decodedToken || typeof decodedToken === 'string') {
        return {
          isValid: false,
          error: 'Invalid JWT format - failed to decode token',
        };
      } // Extract kid from header with enhanced validation
      const header = decodedToken.header;
      console.debug('JWT token header analysis:', {
        headerExists: !!header,
        headerType: typeof header,
        headerKeys: header ? Object.keys(header) : [],
        alg: header?.alg,
        typ: header?.typ,
        kid: header?.kid,
        hasKid: !!header?.kid,
        kidType: typeof header?.kid,
        kidLength: header?.kid ? header.kid.length : 0,
      });

      // Validate header structure first
      if (!header) {
        return {
          isValid: false,
          error: 'Invalid token: missing header section',
        };
      }

      // Check for required header fields
      if (!header.alg) {
        return {
          isValid: false,
          error: 'Invalid token: missing algorithm (alg) in header',
        };
      } // Extract and validate kid
      const kid = header.kid;
      if (!kid || typeof kid !== 'string' || kid.trim() === '') {
        const isDevelopment = process.env['NODE_ENV'] === 'development';
        if (isDevelopment) {
          console.warn(
            'JWT token missing or invalid kid in header. Full header:',
            header
          );
        }
        return {
          isValid: false,
          error:
            'Invalid token: missing or invalid key ID (kid) in header. Token may be malformed or from wrong issuer.',
        };
      }

      const isDevelopment = process.env['NODE_ENV'] === 'development';
      if (isDevelopment) {
        console.debug('JWT validation started', {
          kid,
          algorithm: decodedToken.header?.alg,
          tokenType: decodedToken.header?.typ,
        });
      }

      // Step 2: Get signing key with enhanced error handling
      let signingKey: string;
      try {
        signingKey = await this.getSigningKey(kid);
      } catch (keyError) {
        console.error('Failed to retrieve signing key:', keyError);
        return {
          isValid: false,
          error: `Unable to verify token signature: ${
            keyError instanceof Error
              ? keyError.message
              : 'Key retrieval failed'
          }`,
        };
      }

      // Step 3: JWT verification options with enhanced configuration
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: ['RS256'],
        audience: this.config.audience || this.config.clientId,
        issuer:
          this.config.issuer ||
          `https://${this.config.tenantId}.ciamlogin.com/${this.config.tenantId}/v2.0`,
        clockTolerance: 300, // Increased to 5 minutes for clock skew tolerance
        ignoreExpiration: false,
        ignoreNotBefore: false,
      };

      console.debug('JWT verification options:', {
        algorithms: verifyOptions.algorithms,
        audience: verifyOptions.audience,
        issuer: verifyOptions.issuer,
        clockTolerance: verifyOptions.clockTolerance,
      });

      // Step 4: Verify token with detailed error handling
      let decoded: B2CTokenClaims;
      try {
        decoded = jwt.verify(
          token,
          signingKey,
          verifyOptions
        ) as B2CTokenClaims;
        console.debug('JWT signature verification successful');
      } catch (verificationError) {
        console.error('JWT verification failed:', {
          error:
            verificationError instanceof Error
              ? verificationError.message
              : 'Unknown error',
          name:
            verificationError instanceof Error
              ? verificationError.name
              : 'Unknown',
        });

        // Return specific error messages based on verification failure type
        if (verificationError instanceof jwt.TokenExpiredError) {
          return { isValid: false, error: 'Token has expired' };
        } else if (verificationError instanceof jwt.JsonWebTokenError) {
          return { isValid: false, error: 'Invalid token format or signature' };
        } else if (verificationError instanceof jwt.NotBeforeError) {
          return { isValid: false, error: 'Token not active yet' };
        } else {
          return {
            isValid: false,
            error: `Token verification failed: ${
              verificationError instanceof Error
                ? verificationError.message
                : 'Unknown error'
            }`,
          };
        }
      }

      // Step 5: Additional validation
      const validationResult = this.validateClaims(decoded);
      if (!validationResult.isValid) {
        console.warn('Token claims validation failed:', validationResult.error);
        return validationResult;
      }

      // Step 6: Extract user info dan scopes
      const userId = decoded.sub;
      const scopes = decoded.scp ? decoded.scp.split(' ') : [];

      console.info('JWT validation successful', {
        userId: userId?.substring(0, 8) + '...', // Log only first 8 chars for privacy
        scopesCount: scopes.length,
        issuer: decoded.iss,
      });

      return {
        isValid: true,
        claims: decoded,
        userId,
        scopes,
      };
    } catch (error) {
      console.error('Unexpected error in JWT validation:', error);

      let errorMessage = 'Token validation failed';
      if (error instanceof jwt.TokenExpiredError) {
        errorMessage = 'Token has expired';
      } else if (error instanceof jwt.JsonWebTokenError) {
        errorMessage = 'Invalid token format';
      } else if (error instanceof jwt.NotBeforeError) {
        errorMessage = 'Token not active yet';
      } else if (error instanceof Error) {
        errorMessage = `Token validation failed: ${error.message}`;
      }

      return {
        isValid: false,
        error: errorMessage,
      };
    }
  }
  /**
   * Validate token claims
   */ private validateClaims(claims: B2CTokenClaims): TokenValidationResult {
    // Check required claims
    if (!claims.sub) {
      return {
        isValid: false,
        error: 'Missing user identifier in token',
      };
    }

    // For CIAM tokens, validate against the frontend client ID (audience)
    const expectedAudience = this.config.audience || this.config.clientId;
    if (
      !claims.aud ||
      (Array.isArray(claims.aud)
        ? !claims.aud.includes(expectedAudience)
        : claims.aud !== expectedAudience)
    ) {
      console.warn('Token audience validation failed', {
        expectedAudience,
        actualAudience: claims.aud,
        audienceType: Array.isArray(claims.aud) ? 'array' : typeof claims.aud,
      });

      // For development, be more lenient with audience validation
      const isDevelopment =
        process.env['NODE_ENV'] === 'development' ||
        process.env['AZURE_FUNCTIONS_ENVIRONMENT'] === 'Development';

      if (!isDevelopment) {
        return {
          isValid: false,
          error: 'Token audience mismatch',
        };
      } else {
        console.warn('Development mode: Allowing audience mismatch');
      }
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
    }

    // Validate issuer format (updated for CIAM) with multiple accepted formats
    const expectedIssuers = [
      `https://${this.config.tenantId}.ciamlogin.com/${this.config.tenantId}/v2.0`,
      `https://${this.config.tenantName}.ciamlogin.com/${this.config.tenantId}/v2.0`,
      // Alternative formats that might be used
      `https://${this.config.tenantName}.ciamlogin.com/${this.config.tenantName}.onmicrosoft.com/v2.0`,
    ];

    const isValidIssuer = expectedIssuers.some(
      (issuer) => claims.iss === issuer
    );

    if (!isValidIssuer) {
      console.warn('Token issuer validation failed', {
        expectedIssuers,
        actualIssuer: claims.iss,
      });

      // For development, be more lenient with issuer validation
      const isDevelopment =
        process.env['NODE_ENV'] === 'development' ||
        process.env['AZURE_FUNCTIONS_ENVIRONMENT'] === 'Development';

      if (!isDevelopment) {
        return {
          isValid: false,
          error: 'Invalid token issuer',
        };
      } else {
        console.warn('Development mode: Allowing issuer mismatch');
      }
    }

    // For CIAM: Validate that token contains required scope for API access
    const requiredScope = 'Virpal.ReadWrite'; // CIAM scope for this API
    if (!this.hasScope(claims, requiredScope)) {
      console.warn('Token scope validation failed', {
        requiredScope,
        actualScopes: claims.scp,
        hasScope: this.hasScope(claims, requiredScope),
      });

      // For development or if no scope is required, be more lenient
      const isDevelopment =
        process.env['NODE_ENV'] === 'development' ||
        process.env['AZURE_FUNCTIONS_ENVIRONMENT'] === 'Development';

      if (!isDevelopment && claims.scp) {
        // Only check if scopes exist
        return {
          isValid: false,
          error: `Missing required permission: ${requiredScope}`,
        };
      } else {
        console.warn(
          'Development mode or no scopes: Allowing scope validation to pass'
        );
      }
    }

    console.debug('Token claims validation successful');
    return { isValid: true };
  }

  /**
   * Extract user information dari token claims
   */ extractUserInfo(claims: B2CTokenClaims): {
    userId: string;
    email?: string | undefined;
    name?: string | undefined;
    givenName?: string | undefined;
    familyName?: string | undefined;
  } {
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
  hasScope(claims: B2CTokenClaims, requiredScope: string): boolean {
    if (!claims.scp) return false;

    const scopes = claims.scp.split(' ');
    return scopes.includes(requiredScope);
  }
  /**
   * Get token info untuk debugging
   */
  getTokenInfo(token: string): {
    header?: jwt.JwtHeader;
    payload?: jwt.JwtPayload;
    isExpired?: boolean;
  } {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded.payload === 'string') return {};

      const payload = decoded.payload as jwt.JwtPayload;
      const isExpired = payload.exp
        ? payload.exp < Math.floor(Date.now() / 1000)
        : false;

      return {
        header: decoded.header,
        payload: decoded.payload as jwt.JwtPayload,
        isExpired,
      };
    } catch {
      return {};
    }
  }
}

/**
 * Create JWT validation service dengan configuration dari environment variables
 */
export function createJWTService(): JWTValidationService {
  // Retrieve required environment variables - no fallback values for security
  const tenantName = process.env['AZURE_TENANT_NAME'];
  const tenantId = process.env['AZURE_TENANT_ID'];
  const backendClientId = process.env['AZURE_BACKEND_CLIENT_ID'];
  const userFlow = process.env['AZURE_USER_FLOW'] || '';

  // Validate that all required environment variables are present
  const missingVars: string[] = [];
  if (!tenantName) missingVars.push('AZURE_TENANT_NAME');
  if (!tenantId) missingVars.push('AZURE_TENANT_ID');
  if (!backendClientId) missingVars.push('AZURE_BACKEND_CLIENT_ID');

  if (missingVars.length > 0) {
    const errorMessage =
      `Missing required environment variables for JWT authentication: ${missingVars.join(
        ', '
      )}. ` +
      'Please ensure these variables are set in your environment or .env file. ' +
      'See .env.example for configuration template.';

    console.error('JWT Service Configuration Error:', {
      missingVariables: missingVars,
      availableEnvVars: {
        AZURE_TENANT_NAME: !!process.env['AZURE_TENANT_NAME'],
        AZURE_TENANT_ID: !!process.env['AZURE_TENANT_ID'],
        AZURE_BACKEND_CLIENT_ID: !!process.env['AZURE_BACKEND_CLIENT_ID'],
        AZURE_USER_FLOW: !!process.env['AZURE_USER_FLOW'],
      },
    });

    throw new Error(errorMessage);
  }
  const config: JWTServiceConfig = {
    tenantName: tenantName!,
    tenantId: tenantId!,
    clientId: backendClientId!,
    userFlow,
    // Use CIAM endpoints without user flow (External ID uses different format)
    jwksUri: `https://${tenantName}.ciamlogin.com/${tenantId}/discovery/v2.0/keys`,
    // Issuer for CIAM (External ID) tokens - no user flow
    issuer: `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0`,
    // For CIAM, audience should be the backend API client ID
    audience: backendClientId!,
  };

  console.info('JWT Service initialized with environment variables', {
    tenantName: tenantName!.substring(0, 3) + '***', // Partial logging for security
    tenantId: tenantId!.substring(0, 8) + '***',
    clientId: backendClientId!.substring(0, 8) + '***',
    hasUserFlow: !!userFlow,
  });

  return new JWTValidationService(config);
}

export { JWTValidationService };
export default createJWTService;
