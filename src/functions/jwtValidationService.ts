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
import type { InvocationContext } from '@azure/functions';
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
  [key: string]: any;
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
      // Log error without exposing sensitive key information
      throw new Error('Failed to get signing key');
    }
  }

  /**
   * Validate JWT token
   */ async validateToken(
    token: string,
    context: InvocationContext
  ): Promise<TokenValidationResult> {
    try {
      // Decode token header untuk mendapatkan kid
      const decodedHeader = jwt.decode(token, { complete: true });
      if (!decodedHeader || !decodedHeader.header.kid) {
        return {
          isValid: false,
          error: 'Invalid token: missing key ID (kid) in header',
        };
      }

      const kid = decodedHeader.header.kid;

      // Get signing key
      const signingKey = await this.getSigningKey(kid);

      // JWT verification options
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: ['RS256'],
        audience: this.config.audience || this.config.clientId,
        // For CIAM tokens, issuer includes the user flow
        issuer:
          this.config.issuer ||
          `https://${this.config.tenantName}.ciamlogin.com/${this.config.tenantId}/${this.config.userFlow}/v2.0/`,
        clockTolerance: 60, // 60 seconds tolerance for clock skew
      };

      // Verify token
      const decoded = jwt.verify(
        token,
        signingKey,
        verifyOptions
      ) as B2CTokenClaims;

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
    } catch (error) {
      let errorMessage = 'Token validation failed';
      if (error instanceof jwt.TokenExpiredError) {
        errorMessage = 'Token has expired';
      } else if (error instanceof jwt.JsonWebTokenError) {
        errorMessage = 'Invalid token format';
      } else if (error instanceof jwt.NotBeforeError) {
        errorMessage = 'Token not active yet';
      } else {
        context.error(
          'JWT validation error:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      return {
        isValid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate token claims
   */ private validateClaims(
    claims: B2CTokenClaims,
    context: InvocationContext
  ): TokenValidationResult {
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
      context.warn(
        `Token audience mismatch. Expected: ${expectedAudience}, Got: ${claims.aud}`
      );
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
    }

    // Validate issuer format (updated for CIAM with user flow)
    const expectedIssuerPattern = new RegExp(
      `https://${this.config.tenantName}\\.ciamlogin\\.com/.*/v2\\.0/`
    );
    if (!expectedIssuerPattern.test(claims.iss)) {
      context.warn(`Invalid token issuer: ${claims.iss}`);
      return {
        isValid: false,
        error: 'Invalid token issuer',
      };
    }

    // For CIAM: Validate that token contains required scope for API access
    const requiredScope = 'Virpal.ReadWrite'; // CIAM scope for this API
    if (!this.hasScope(claims, requiredScope)) {
      context.warn(
        `Token missing required scope: ${requiredScope}. Available: ${claims.scp}`
      );
      return {
        isValid: false,
        error: `Missing required permission: ${requiredScope}`,
      };
    }

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
    header?: any;
    payload?: any;
    isExpired?: boolean;
  } {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded) return {};

      const payload = decoded.payload as JwtPayload;
      const isExpired = payload.exp
        ? payload.exp < Math.floor(Date.now() / 1000)
        : false;

      return {
        header: decoded.header,
        payload: decoded.payload,
        isExpired,
      };
    } catch (error) {
      return {};
    }
  }
}

/**
 * Create JWT validation service dengan configuration dari environment variables
 */
export function createJWTService(): JWTValidationService {
  const config: JWTServiceConfig = {
    tenantName: process.env['AZURE_TENANT_NAME'] || '',
    tenantId: process.env['AZURE_TENANT_ID'] || '',
    clientId: process.env['AZURE_BACKEND_CLIENT_ID'] || '',
    userFlow: process.env['AZURE_USER_FLOW'] || '',
    // Use CIAM endpoints - will be constructed from environment variables
    jwksUri: `https://${
      process.env['AZURE_TENANT_NAME'] || 'your-tenant'
    }.ciamlogin.com/${
      process.env['AZURE_TENANT_ID'] || 'your-tenant.onmicrosoft.com'
    }/discovery/v2.0/keys?p=${
      process.env['AZURE_USER_FLOW'] || 'your-user-flow'
    }`,
    // Issuer includes user flow for CIAM tokens
    issuer: `https://${
      process.env['AZURE_TENANT_NAME'] || 'your-tenant'
    }.ciamlogin.com/${
      process.env['AZURE_TENANT_ID'] || 'your-tenant.onmicrosoft.com'
    }/${process.env['AZURE_USER_FLOW'] || 'your-user-flow'}/v2.0/`,
    // For CIAM, audience should be the frontend client ID that requested the token
    audience: process.env['AZURE_FRONTEND_CLIENT_ID'] || '',
  };

  // Validate configuration
  const requiredFields = ['tenantName', 'tenantId', 'clientId'];
  for (const field of requiredFields) {
    if (!config[field as keyof JWTServiceConfig]) {
      throw new Error(`Missing required JWT configuration: ${field}`);
    }
  }

  return new JWTValidationService(config);
}

export { JWTValidationService };
export default createJWTService;
