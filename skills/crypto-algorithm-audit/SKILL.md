---
name: crypto-algorithm-audit
description: Equips the advisor to audit cryptographic choices — algorithms, modes, key handling, and randomness — against current standards.
---

# Cryptographic Algorithm Auditing

Crypto review is mostly subtraction: the dangerous choices are well known and rarely justified.
The reviewer checks algorithm selection, mode of operation, key/IV handling, password hashing, and randomness sources against current guidance (NIST, the OWASP Password Storage Cheat Sheet), and treats any hand-rolled construction as a defect by default.

## Watch for
- Broken or deprecated primitives: MD5, SHA-1 for security purposes, DES/3DES, RC4, RSA keys under 2048 bits
- ECB mode, or CBC without authenticated encryption (missing HMAC / no encrypt-then-MAC) — padding oracle exposure
- Hardcoded keys/IVs/salts in source, or IVs reused across messages (fatal for GCM and stream ciphers)
- Passwords hashed with MD5/SHA-1/SHA-256 (even salted) instead of bcrypt/scrypt/argon2id
- Math.random(), rand(), or UUID v4 used for tokens, session ids, or any security value
- Custom crypto: homegrown encodings, XOR "encryption", bespoke MAC or KDF constructions
- JWT algorithm confusion: `none` accepted, or HS/RS key confusion possible in verification

## Best practices
- Symmetric: AES-256-GCM (or ChaCha20-Poly1305) with a fresh random 96-bit nonce per encryption
- Passwords: argon2id (or bcrypt cost ≥ 10) with per-user salts; tune memory/time to server limits
- Tokens/secrets: CSPRNG only (crypto.getRandomValues, Python secrets, /dev/urandom), ≥ 128 bits of entropy
- Keys in KMS/HSM or a secret manager; never in code, committed env files, or client bundles
- JWT verification: pin the expected algorithm, reject none, validate exp/iss/aud
- Use vetted libraries (libsodium, WebCrypto, language-standard crypto) — never implement primitives
- Hash for integrity with SHA-256+; for keyed integrity use HMAC-SHA256, not plain hashes

## Quick checklist
- [ ] No MD5/SHA-1/DES/RC4 for any security purpose in the diff
- [ ] Authenticated encryption mode (GCM/ChaCha20-Poly1305) with unique nonces
- [ ] No hardcoded keys, IVs, or salts anywhere in the change
- [ ] Passwords use argon2id/bcrypt/scrypt
- [ ] All security random values from a CSPRNG
- [ ] JWT verification pins algorithm and validates claims
- [ ] No hand-rolled primitives or encodings
