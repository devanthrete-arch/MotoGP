# Autoflex Stitch design reference

## Source

- Project: [Autoflex Automotive Management System](https://stitch.withgoogle.com/projects/13052758531426466821)
- Generated: July 30, 2026
- Format: responsive web application
- Screens: Today desktop, Today mobile, Shortlist desktop, Garage desktop,
  Community desktop, and Profile/Settings desktop

The Stitch project is the visual exploration record for the production redesign.
The implemented React application remains authoritative for behavior,
accessibility, responsive layout, and release verification.

## Design DNA

- Primary: petrol teal `#0E4E4B`
- Action: safety yellow `#F2B632`
- Warning: coral `#E05D5D`
- Canvas: cool mist `#EEF2F0`
- Display and labels: Archivo
- Interface and data: Manrope
- Shape: crisp 4-8px radii
- Layout: stable desktop rail, stable four-item mobile dock, task-first screens
- Motion: instant navigation; restrained feedback under 220ms; reduced-motion
  support

## Adopted

- Four stable primary destinations with no changing navigation semantics
- Data-led first viewport for vehicle ownership and buying tasks
- Clear separation between primary actions and navigation
- Workshop-derived palette, typography, imagery, and iconography
- Full-width utility rows for backup, restore, notifications, and destructive
  data controls
- Whitespace and dividers instead of nested card containers

## Deliberately changed

Stitch suggested some operator-oriented labels such as "Fleet Management",
"User Configuration", "Notification Protocols", and "Destructive Action
Protocol". Those labels were not adopted because Autoflex is a consumer
ownership product. The implementation uses plain language: Garage, Settings,
Notifications, Download my data, Restore from backup, and Clear data on this
device.

The generated Settings screen also combined profile, notification, data, and
support content into one dense desktop surface. Autoflex keeps Profile and
Notifications as focused sub-screens and limits Settings to data, privacy, and
device preferences.

## Verification

The implemented screens are verified separately at 390px mobile and 1280px
desktop. Acceptance requires no horizontal overflow, mobile dock clearance,
visible keyboard focus, reduced-motion behavior, working named actions, and
plain customer-facing copy.
