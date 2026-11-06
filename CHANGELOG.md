# Changelog

All notable changes to Modas Jayjo POS are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and project releases will use Semantic Versioning.

## [Unreleased]

### Added
- Unit or global discounts in whole COP, validated and stored by the backend with net payment and cash totals (CR-036).
- Edit authorized users and revoke existing sessions after credential or permission changes; relink Google when the authorized email changes (CR-034).
- On-demand camera barcode scanner in sales and inventory, with live preview, camera cleanup and manual input fallback (CR-034).
- Responsive login and role dashboards, plus sequential point-of-sale screens for garment selection, cash payment, and sale confirmation.
- Manual product lookup by name or SKU, with exact-SKU entry support.

### Changed
- Replace the scanner placeholder illustration with a sale summary and open garment registration from Add garment while retaining its existing styling (CR-036).
- Separate operation and administration dashboards with role-aware header navigation, supplied brand assets, responsive module cards, and explicit upcoming metrics/reports (CR-032).
- Personal supports account reactivation; product lookup loads the full paginated catalog, combines variant terms, and accepts exact SKU scans with Enter (CR-030).
- Sales opens the cash-register flow when required and resumes the sale after opening while preserving administrator permissions and the cart (CR-030).
- Align backend dependency pins for Python 3.12 and use published binary wheels for the Rust-backed Pydantic core and cryptography packages.
