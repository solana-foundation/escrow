# Audit Status

Last updated: 2026-04-07

## Current Baseline

- Auditor: Accretion
- Report: `audits/2026-accretion-solana-foundation-escrow-audit-A26SFR3.pdf`
- Audited-through commit: `36187ad52c7c03d11b13b6f1da9461f2f757cee2`
- Compare unaudited delta: https://github.com/solana-foundation/escrow/compare/36187ad52c7c03d11b13b6f1da9461f2f757cee2...main

Audit scope is commit-based. Commits after the audited-through SHA are considered unaudited until a new audit or mitigation review updates this file.

## Branch and Release Model

- `main` is the integration branch and may contain audited and unaudited commits.
- Stable production releases are immutable tags/releases (for example `v1.0.0`).
- Audited baselines are tracked by commit SHA plus immutable tags/releases, not by long-lived release branches.

## Verification Commands

```bash
# Count commits after the audited baseline
git rev-list --count 36187ad52c7c03d11b13b6f1da9461f2f757cee2..main

# Inspect commit list since audited baseline
git log --oneline 36187ad52c7c03d11b13b6f1da9461f2f757cee2..main

# Inspect file-level diff since audited baseline
git diff --name-status 36187ad52c7c03d11b13b6f1da9461f2f757cee2..main
```

## Maintenance Rules

When a new audit is completed:

1. Add the new report to `audits/`.
2. Update `Audited-through commit` and `Compare unaudited delta`.
3. Tag audited release commit(s) (for example `vX.Y.Z`).
4. Update README and release notes links if needed.
