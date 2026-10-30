# Security Policy

## Supported Versions

Only the latest minor release branch receives security updates and vulnerability patches.

| Version | Supported |
| :------ | :-------- |
| 0.92.x  | Yes       |
| < 0.92  | No        |

---

## Reporting a Vulnerability

We take the security and integrity of `@pplnd/core` seriously. If you identify a potential security
vulnerability, report it responsibly through private channels.

### Coordinated Disclosure Procedure

1. **Submit via GitHub Private Vulnerability Reporting (PVR)**: Navigate to the
   [Security Advisories](https://github.com/pplnd/core/security/advisories/new) tab of this
   repository and open a draft advisory with details of the issue.

2. **Required Details**:
   - Description of the vulnerability and its potential impact.
   - Minimal reproducible proof of concept (PoC) or failing test case.
   - Affected versions and configurations.

3. **Response Timelines**:
   - **Initial Acknowledgment**: Within 48 hours of receipt.
   - **Triage and Assessment**: Within 5 business days.
   - **Coordinated Disclosure**: Fixes are released alongside a GitHub Security Advisory once
     validated.

Do not disclose vulnerabilities via public GitHub issues, discussions, or pull requests.

---

## Supply Chain & Distribution Security

- **Staged Publishing**: All package releases are submitted to an npm quarantine staging queue
  (`npm stage publish`) without public access until an authenticated maintainer approves the release
  with hardware/TOTP Two-Factor Authentication (`npm stage approve`).
- **Cryptographic Provenance**: Every release artifact includes Sigstore attestation linking the
  built tarball to its exact source commit SHA and GitHub Actions runner.
- **Dependency Quarantine**: Upstream dependency updates are quarantined via a 24-hour delay window
  (`minimumReleaseAge: 1440` in `pnpm-workspace.yaml`).
- **Strict Execution Boundaries**: Dependency lifecycle scripts (`preinstall`, `postinstall`) are
  blocked by default and restricted solely to audited native build tooling.
