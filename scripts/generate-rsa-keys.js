#!/usr/bin/env node

import { generateRSAKeyPair } from '../src/utils/cryptoKeys.js';

const { publicKey, privateKey } = generateRSAKeyPair();

console.log('='.repeat(80));
console.log('RSA Key Pair Generated for RS256 JWT Signing');
console.log('='.repeat(80));
console.log('\n📝 Add these to your .env file:\n');
console.log('JWT_PRIVATE_KEY="""');
console.log(privateKey);
console.log('"""\n');
console.log('JWT_PUBLIC_KEY="""');
console.log(publicKey);
console.log('"""\n');
console.log('Or if your environment doesn\'t support multiline values:');
console.log('\nJWT_PRIVATE_KEY (escaped):\n');
console.log(JSON.stringify(privateKey));
console.log('\n\nJWT_PUBLIC_KEY (escaped):\n');
console.log(JSON.stringify(publicKey));
console.log('\n' + '='.repeat(80));
console.log('⚠️  Keep JWT_PRIVATE_KEY secure! Never commit it to version control.');
console.log('='.repeat(80));
