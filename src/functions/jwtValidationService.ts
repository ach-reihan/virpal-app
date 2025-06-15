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
 * - Flexible key ID handling (supports tokens with or without kid)
 * - Multiple signing key fallback when kid is missing
 *
 * Best Practices Applied:
 * - Security validation (signature, expiry, audience)
 * - Performance optimization (JWKS caching)
 * - Comprehensive error handling
 * - Detailed logging untuk debugging
 * - Type safety dengan interfaces
 * - Graceful fallback for tokens without key ID
 */

import type { JwtPayload } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
// Use jwks-rsa instead of jwks-client
import jwksClient from 'jwks-rsa';
import { getEntraIDConfig, getJWTConfig } from './credentialHelper.js';

/**
 * JWKS (JSON Web Key Set) Response Interface
 */
interface JWKSResponse {
  keys: JWKSKey[];
}

/**
 * Individual JWK (JSON Web Key) Interface
 */
interface JWKSKey {
  kty: string; // Key type (e.g., 'RSA')
  use?: string; // Key use (e.g., 'sig' for signature)
  kid?: string; // Key ID
  x5c?: string[]; // X.509 certificate chain
  n?: string; // RSA modulus
  e?: string; // RSA exponent
  alg?: string; // Algorithm
}

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
   * Supports both kid-based key retrieval and fallback to all available keys
   */
  private async getSigningKey(kid?: string): Promise<string> {
    try {
      // If kid is provided, try to get the specific key
      if (kid && typeof kid === 'string' && kid.trim() !== '') {
        const key = await this.jwksClient.getSigningKey(kid);
        return key.getPublicKey();
      }

      // Fallback: Try to get the first available signing key
      // This is useful when token doesn't have kid or kid is invalid
      const isDevelopment = process.env['NODE_ENV'] === 'development';
      if (isDevelopment) {
        console.warn(
          'No valid kid provided, attempting to retrieve first available signing key'
        );
      }

      // Create a direct JWKS request to get all keys
      const jwksUri = `https://${this.config.tenantName}.ciamlogin.com/${this.config.tenantName}.onmicrosoft.com/${this.config.userFlow}/discovery/v2.0/keys`;

      try {
        const response = await fetch(jwksUri);
        if (!response.ok) {
          throw new Error(`JWKS endpoint returned ${response.status}`);
        }
        const jwks = (await response.json()) as JWKSResponse;
        if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
          throw new Error('No keys found in JWKS response');
        }

        // Try each key until one works (for tokens without kid)
        for (const key of jwks.keys) {
          if (key.kty === 'RSA' && key.use === 'sig' && key.x5c && key.x5c[0]) {
            // Convert x5c certificate to PEM format
            const cert = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
            if (isDevelopment) {
              console.info(
                `Using signing key with kid: ${key.kid || 'unknown'}`
              );
            }
            return cert;
          }
        }

        throw new Error('No suitable signing key found in JWKS response');
      } catch {
        // Try alternative JWKS URI format
        const alternativeJwksUri = `https://${this.config.tenantId}.ciamlogin.com/${this.config.tenantId}/discovery/v2.0/keys`;
        if (isDevelopment) {
          console.warn(
            'Primary JWKS failed, trying alternative URI:',
            alternativeJwksUri
          );
        }

        const alternativeResponse = await fetch(alternativeJwksUri);
        if (!alternativeResponse.ok) {
          throw new Error(
            `Alternative JWKS endpoint returned ${alternativeResponse.status}`
          );
        }
        const alternativeJwks =
          (await alternativeResponse.json()) as JWKSResponse;
        if (
          !alternativeJwks.keys ||
          !Array.isArray(alternativeJwks.keys) ||
          alternativeJwks.keys.length === 0
        ) {
          throw new Error('No keys found in alternative JWKS response');
        }

        // Try each key from alternative endpoint
        for (const key of alternativeJwks.keys) {
          if (key.kty === 'RSA' && key.use === 'sig' && key.x5c && key.x5c[0]) {
            const cert = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
            if (isDevelopment) {
              console.info(
                `Using alternative signing key with kid: ${
                  key.kid || 'unknown'
                }`
              );
            }
            return cert;
          }
        }

        throw new Error(
          'No suitable signing key found in alternative JWKS response'
        );
      }
    } catch (error) {
      const isDevelopment = process.env['NODE_ENV'] === 'development';
      if (isDevelopment) {
        console.error('JWKS signing key error details:', {
          kid,
          error: error instanceof Error ? error.message : 'Unknown error',
          jwksUri: `https://${this.config.tenantName}.ciamlogin.com/${this.config.tenantId}/discovery/v2.0/keys`,
        });
      }

      throw new Error(
        `Failed to get signing key${
          kid ? ` for kid: ${kid}` : ' (no kid specified)'
        }. Please check JWKS endpoint configuration. Error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
  /**
   * Validate JWT token
   * Now supports tokens with or without kid in header
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Step 1: Decode token header to get kid without verification
      const decodedToken = jwt.decode(token, { complete: true });

      if (!decodedToken || typeof decodedToken === 'string') {
        return {
          isValid: false,
          error: 'Invalid JWT format - failed to decode token',
        };
      }

      // Extract kid from header (optional now)
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
      }

      // Extract kid (now optional)
      const kid = header.kid;
      const isDevelopment = process.env['NODE_ENV'] === 'development';

      if (isDevelopment) {
        if (!kid || typeof kid !== 'string' || kid.trim() === '') {
          console.warn(
            'JWT token missing or invalid kid in header. Will attempt validation without kid. Full header:',
            header
          );
        } else {
          console.debug('JWT validation started with kid', {
            kid,
            algorithm: decodedToken.header?.alg,
            tokenType: decodedToken.header?.typ,
          });
        }
      }

      // Step 2: Get signing key (now supports fallback without kid)
      let signingKey: string;
      try {
        // Try with kid first if available, fallback to any available key
        signingKey = await this.getSigningKey(
          kid && typeof kid === 'string' && kid.trim() !== '' ? kid : undefined
        );
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
      }); // Step 4: Verify token with detailed error handling and fallback support
      let decoded: B2CTokenClaims | undefined;
      try {
        decoded = jwt.verify(
          token,
          signingKey,
          verifyOptions
        ) as B2CTokenClaims;
        console.debug('JWT signature verification successful');
      } catch (verificationError) {
        console.error('JWT verification failed with primary key:', {
          error:
            verificationError instanceof Error
              ? verificationError.message
              : 'Unknown error',
          name:
            verificationError instanceof Error
              ? verificationError.name
              : 'Unknown',
        });

        // If no kid was provided and verification failed, try all available keys
        if (!kid || typeof kid !== 'string' || kid.trim() === '') {
          if (isDevelopment) {
            console.warn(
              'Primary key failed and no kid available, attempting multiple key validation...'
            );
          }

          try {
            // Try to get all available keys and test each one
            const jwksUri = `https://${this.config.tenantName}.ciamlogin.com/${this.config.tenantName}.onmicrosoft.com/${this.config.userFlow}/discovery/v2.0/keys`;
            const response = await fetch(jwksUri);
            if (response.ok) {
              const jwks = (await response.json()) as JWKSResponse;
              if (jwks.keys && Array.isArray(jwks.keys)) {
                for (const key of jwks.keys) {
                  if (
                    key.kty === 'RSA' &&
                    key.use === 'sig' &&
                    key.x5c &&
                    key.x5c[0]
                  ) {
                    try {
                      const cert = `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
                      decoded = jwt.verify(
                        token,
                        cert,
                        verifyOptions
                      ) as B2CTokenClaims;
                      if (isDevelopment) {
                        console.info(
                          `Successfully verified token with key kid: ${
                            key.kid || 'unknown'
                          }`
                        );
                      }
                      break; // Success, exit the loop
                    } catch (keyVerificationError) {
                      // Continue to next key
                      if (isDevelopment) {
                        console.debug(
                          `Key ${key.kid || 'unknown'} failed verification:`,
                          keyVerificationError instanceof Error
                            ? keyVerificationError.message
                            : 'Unknown error'
                        );
                      }
                    }
                  }
                }
              }
            }
          } catch (multiKeyError) {
            if (isDevelopment) {
              console.error('Multiple key validation failed:', multiKeyError);
            }
          }
        }

        // If we still don't have a decoded token, return the original error
        if (!decoded) {
          // Return specific error messages based on verification failure type
          if (verificationError instanceof jwt.TokenExpiredError) {
            return { isValid: false, error: 'Token has expired' };
          } else if (verificationError instanceof jwt.JsonWebTokenError) {
            return {
              isValid: false,
              error: 'Invalid token format or signature',
            };
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
      }

      // If we still don't have a decoded token, return error
      if (!decoded) {
        return {
          isValid: false,
          error:
            'Token verification failed: Unable to verify signature with any available key',
        };
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
 * Create JWT validation service dengan configuration dari credential helper
 */
export function createJWTService(): JWTValidationService {
  try {
    // Get configuration from credential helper
    const jwtConfig = getJWTConfig();
    const entraConfig = getEntraIDConfig();

    // Extract tenant name from tenant ID for JWKS URI
    const tenantName = entraConfig.tenantId;
    const config: JWTServiceConfig = {
      tenantName: tenantName,
      tenantId: entraConfig.tenantId,
      clientId: entraConfig.clientId,
      userFlow: '',
      // Use CIAM endpoints for External ID
      jwksUri: `https://${tenantName}.ciamlogin.com/${tenantName}/discovery/v2.0/keys`,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    };

    console.info('JWT Service initialized with hackathon credentials', {
      tenantName: tenantName.substring(0, 3) + '***', // Partial logging for security
      tenantId: entraConfig.tenantId.substring(0, 8) + '***',
      clientId: entraConfig.clientId.substring(0, 8) + '***',
      mode: 'hackathon',
    });

    return new JWTValidationService(config);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('JWT Service Configuration Error:', errorMessage);
    throw new Error(`Failed to initialize JWT service: ${errorMessage}`);
  }
}

export { JWTValidationService };
export default createJWTService;
