---
name: mfa-enforcement-policies
description: Equips the advisor to review authentication designs for missing or weak multi-factor enforcement across user, admin, and service access paths.
---

# MFA Enforcement Policies

MFA is the single highest-leverage access control, and its gaps cluster in the places attackers look first: admin consoles, API tokens, VPN, and service accounts. Reviewers check every access path — not just the login page — and treat any privileged route without a second factor as a findings-level issue.

## Watch for
- Admin or privileged roles reachable with password-only authentication.
- MFA offered as optional with no enforcement timeline or coverage metric.
- SMS as the only second factor where stronger options are available.
- Service accounts and CI tokens exempt from rotation or scoping because "they are not users".
- VPN, bastion, or SSO admin consoles outside the MFA policy.
- Remember-device windows so long they defeat the second factor's purpose.
- Recovery/backup codes generated without secure storage or one-time enforcement.
- Step-up authentication missing for sensitive actions after a long-lived session.

## Best practices
- Enforce MFA for all human access; require phishing-resistant factors (WebAuthn/FIDO2) for privileged roles.
- Cover every path: admin consoles, VPN, SSO, source control, cloud consoles, CI logins.
- Scope and rotate service credentials; treat them as the machine equivalent of MFA.
- Keep remember-device windows short and re-verify for sensitive operations (step-up).
- Make backup codes one-time, hashed at rest, and auditable on use.
- Prefer TOTP/WebAuthn over SMS; document any SMS allowance as a temporary exception.
- Track and report MFA coverage per system until it reaches 100% of in-scope accounts.
- Test the enforcement: attempt privileged access with a single factor and confirm denial.

## Quick checklist
- [ ] All privileged access requires a second factor.
- [ ] MFA enforcement is mandatory, not optional, for in-scope systems.
- [ ] Phishing-resistant factors required for admin roles.
- [ ] Service accounts scoped, rotated, and audited.
- [ ] VPN/SSO/admin consoles inside the MFA policy.
- [ ] Remember-device windows short; step-up on sensitive actions.
- [ ] Backup codes one-time, hashed, and usage-logged.
- [ ] Coverage measured and enforcement actively tested.
