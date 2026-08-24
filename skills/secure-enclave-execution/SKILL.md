---
name: secure-enclave-execution
description: Equips the advisor to assess TEE fit (SGX/TDX/SEV-class), verify attestation is actually checked, and keep trust-boundary and side-channel claims honest.
---

# Secure Enclave Execution Review

Trusted execution environments protect data in use, but they shift — not remove — trust: into hardware vendors, attestation infrastructure, and side-channel resistance. This skill reviews TEE-based designs for fit, attestation rigor, and honest trust boundaries. Findings are technical review flags.

## Watch for
- TEE chosen without a threat model that names what the enclave protects against (host compromise? cloud operator?).
- Attestation generated but never verified, or verified against permissive, anything-goes quote policies.
- Secrets provisioned before attestation succeeds, or over channels the attestation does not cover.
- Enclave surface too large: whole applications inside, expanding attack surface and killing performance.
- Side-channel caveats ignored: shared caches, hyperthreading, memory-access patterns unaddressed.
- I/O boundaries leaky: plaintext crossing the enclave boundary through logs, errors, or storage.
- Rollback protection missing: enclave state restorable to an older version by a malicious host.
- Marketing-grade claims ("unhackable", "zero trust") beyond what the hardware actually guarantees.

## Best practices
- Start from the threat model: name the adversary (privileged host, cloud insider) and verify the TEE family addresses it.
- Keep the trusted computing base minimal: only code that must touch secrets goes inside.
- Require remote attestation with strict verification: quote signature, measurement allowlist, freshness, and policy checks before any secret release.
- Bind secrets to the attested measurement; re-attest on updates.
- Address side channels explicitly: document mitigations and residual risk for the chosen platform.
- Audit every boundary crossing: nothing sensitive leaves the enclave in plaintext, including errors and telemetry.
- Include rollback and sealing protections for any persistent enclave state.
- State trust honestly: document what remains trusted (hardware vendor, attestation service) rather than claiming trustlessness.

## Quick checklist
- [ ] Threat model names the adversary the TEE defends against.
- [ ] TCB minimized to secret-touching code only.
- [ ] Remote attestation verified with measurement allowlist + freshness.
- [ ] Secrets released only after successful attestation.
- [ ] Side-channel mitigations documented with residual risk.
- [ ] No plaintext sensitive data crosses the enclave boundary.
- [ ] Rollback/sealing protection for persistent state.
- [ ] Trust-boundary claims match what the hardware actually guarantees.
