# INDIX BuildView

Bilingual buyer and developer portal using the existing owner-restricted ChatGPT Site access gate, D1 persistent data and private R2 attachments.

## First use

The existing Site currently permits only its owner. The owner signs in and creates the developer workspace before granting anyone else Site access. This one-time setup binds the developer role to the first authorized account. The developer creates projects and apartments, creates buyer invitations and assigns each unit. Site sharing access is a separate platform gate; invitation emails are not sent automatically. Invite links expire after 7 days and can be used once.

The developer can create a clearly labelled demonstration project with two apartments. No accounts or real payment records are seeded. The buyer preview is read-only. Existing browser-local prototype data and passwords are not migrated.

## Features

- Account invitations, blocking, buyer-unit separation and role-checked reads and writes.
- Payment plan, proof uploads, developer approval and rejection, calculated balance, printable approved payment acknowledgement. No payment processing.
- Buyer requests, replies and statuses; assigned documents; project and unit progress updates with photos and videos.
- Defects with buyer confirmation; handover appointments, checklist, recorded buyer acknowledgement and printable record. No qualified third-party e-signature.
- Actions and in-app activity history. No email, SMS or push notifications from the Site.

Uploaded PDF, JPG, PNG, WebP, MP4 and WebM files are limited to 20 MB each. Download rights are checked on every request. Approved-payment and handover HTML reports can be printed or saved as PDF by the browser.

## Validate

Run `node node_modules/typescript/bin/tsc --noEmit` and `node tests/workflows.mjs`. The workflow test uses in-memory SQLite and fake R2 to exercise invitations, two-buyer isolation, approvals, files, requests, defects and handover. It creates no hosted records. Generated D1 migrations under `drizzle/` become immutable once applied to the hosted database.

This Site relies on the access-controlled ChatGPT Site. The dispatcher currently supplies a verified email but no stable user-id header; the normalized verified email is its account key. A changed ChatGPT account email needs account relinking. Independent phone and password sign-in needs an external identity provider. One developer company per Site. Transfer of an assigned unit is reserved for a separately reviewed ownership process.
