# Changelog

All notable changes to Modas Jayjo POS are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and project releases will use Semantic Versioning.

## [Unreleased]

### Added
- Responsive login and role dashboards, plus sequential point-of-sale screens for garment selection, cash payment, and sale confirmation.
- Manual product lookup by name or SKU, with exact-SKU entry support.

### Changed
- Personal supports account reactivation; product lookup loads the full paginated catalog, combines variant terms, and accepts exact SKU scans with Enter (CR-030).
- Sales opens the cash-register flow when required and resumes the sale after opening while preserving administrator permissions and the cart (CR-030).
- Align backend dependency pins for Python 3.12 and use published binary wheels for the Rust-backed Pydantic core and cryptography packages.
