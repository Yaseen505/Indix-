# INDIX BuildView — Claude Code handoff

This ZIP contains the complete tracked source for deployed Site version 7 (commit bec89e52b49ea504af001a2e1d927025f29b960f), captured 2026-09-26. Extract it and read README.md before changing code.

## Review request
1. Inspect the current architecture and reproduce any reported UI freeze or visible errors. Identify the cause with evidence before changing behavior.
2. Check buyer/developer permissions and two-buyer data isolation, file access, Arabic RTL and English LTR, mobile layout, payments, documents, progress and handover flows.
3. Run `pnpm install --frozen-lockfile`, `node node_modules/typescript/bin/tsc --noEmit`, and `node tests/workflows.mjs`; explain any environment-specific failure. The production runtime uses Sites with Cloudflare D1 and R2 bindings.
4. Propose and implement prioritized fixes, preserve current features and migration history, then report changed files, tests run and remaining issues.

## Important boundaries
This is the buyer portal, separate from the original INDIX construction management app. The ZIP contains source code and migrations, not hosted D1 records, R2 uploads, site access settings, deployment credentials or a copy of the live database. Never assume demo data represents actual buyers. No secrets are included. The `.openai/hosting.json` manifest identifies the existing Site; coordinate deployment separately if working outside Sites.

Live URL: https://indix-buildview-buyer.yasensuiss.chatgpt.site

## Owner's feature checklist (audit existing code first)
For each item, report **working / partly working / broken / missing**, cite the relevant files, reproduce the behavior where possible, and list the next action. Do not claim that a requested feature is already implemented merely because it is listed here.

- Pricing and quotations: developer proposal, buyer approval or rejection, and a retained history.
- Requests and defects: buyer opens a request with an image, then tracks it through closure.
- Documents: contract, technical specifications, apartment plan, bank guarantees and handover protocol; verify buyer-only access.
- Visit scheduling: book an on-site visit or a representative meeting.
- Handover and aftercare: handover checklist and defect reports during the responsibility period.
- Languages: Hebrew, Arabic and English; verify whether Hebrew exists, and test complete RTL/LTR behavior where implemented.

Also inspect the current UI freezing and errors seen by the owner. Distinguish implemented features from ideas still to build; prioritize defects that block use.
