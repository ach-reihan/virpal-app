#!/usr/bin/env node

/**
 * VirPal App - JWT Secret Generator untuk Hackathon
 * Copyright (c) 2025 Achmad Reihan Alfaiz. All rights reserved.
 *
 * Quick script untuk generate JWT secret yang aman untuk hackathon
 */

const crypto = require('crypto');

console.log('\n🔐 VirPal App - JWT Secret Generator untuk Hackathon');
console.log('='.repeat(60));

// Generate secure random JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log('\n✅ JWT Secret berhasil di-generate!');
console.log('\n📋 Copy JWT Secret berikut ke src/config/credentials.ts:');
console.log('-'.repeat(60));
console.log(`"${jwtSecret}"`);
console.log('-'.repeat(60));

console.log('\n📝 Update di file credentials.ts:');
console.log(`
jwt: {
  secret: "${jwtSecret}",
  issuer: "https://db0374b9-bb6f-4410-ad04-db7fe70f4d7b.ciamlogin.com/db0374b9-bb6f-4410-ad04-db7fe70f4d7b/v2.0",
  audience: "9ae4699e-0823-453e-b0f7-b614491a80a2"
}
`);

console.log('\n🚀 Langkah selanjutnya:');
console.log('1. Copy JWT secret di atas');
console.log('2. Paste ke src/config/credentials.ts');
console.log('3. Jalankan: npm run functions:build');
console.log('4. Test: npm run watch');

console.log('\n🎯 Ready untuk hackathon elevAIte with Dicoding 2025!');
console.log('='.repeat(60));
