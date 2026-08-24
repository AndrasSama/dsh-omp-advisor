---
name: client-side-encryption-ops
description: Equips the advisor to review end-to-end encryption designs for real key-management rigor and to challenge server-zero-knowledge claims against what the system actually does.
---

# Client-Side Encryption Operations

End-to-end encryption is only as strong as its key lifecycle, and "zero-knowledge server" is a claim that must be verified against architecture, not marketing. This skill reviews E2EE designs for where keys live, how they are generated and rotated, and what the server can actually see. Findings are security review flags.

## Watch for
- Keys generated server-side, transmitted through the server, or escrowed "for convenience" without disclosure.
- Passphrase-derived keys using weak KDF parameters (low iteration counts, no memory-hard function).
- Private keys stored in plaintext local storage, synced to cloud, or included in backups.
- Metadata left unprotected while content is encrypted (who, when, how much, with whom).
- Key rotation or revocation missing: compromised or departed keys remain valid forever.
- Multi-device or group sharing schemes that silently widen decryption capability.
- Zero-knowledge claims contradicted by server-visible plaintext paths (search indexing, previews, push payloads).
- No recovery story, or a recovery story that quietly reintroduces server knowledge.

## Best practices
- Trace every key from generation to destruction: where created, where stored, who can read it, when rotated.
- Require client-side key generation with a CSPRNG and a memory-hard KDF for passphrase-derived material.
- Verify plaintext exists only in client memory: audit server endpoints for any plaintext touchpoint.
- Treat metadata as a first-class privacy surface; minimize it and encrypt where feasible.
- Demand rotation, revocation, and device-removal procedures with tested paths.
- Review sharing designs for least privilege: per-recipient keys, forward secrecy where the protocol supports it.
- Test recovery flows to confirm they create no silent escrow.
- Match claims to evidence: every "zero-knowledge" statement needs an architecture reference reviewers can check.

## Quick checklist
- [ ] Keys generated client-side with a CSPRNG.
- [ ] KDF parameters memory-hard or adequately tuned.
- [ ] Private keys never plaintext-persisted or cloud-synced.
- [ ] Server has no plaintext touchpoint (verified per endpoint).
- [ ] Metadata exposure assessed and minimized.
- [ ] Rotation/revocation/device-removal procedures exist and are tested.
- [ ] Recovery flow introduces no silent escrow.
- [ ] Every zero-knowledge claim backed by architecture evidence.
