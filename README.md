# TeraShip — SwiftRoute Logistics edition

A front-end courier operations prototype branded for **SwiftRoute Logistics**, powered by **TeraShip by TeraSyncTech**.

## Included modules
- Dashboard and shipment list
- Manual shipment booking records
- Sample rate comparison
- Manual/demo AWB tracking timeline
- Customer accounts, billing, COD records and reports
- Local browser storage for prototype data

## Current limitations
This package is still a front-end prototype. Data is stored in the browser on the device where it is used. It has no secure user login, shared database, real courier booking, live rates, carrier tracking, payment processing or bank settlement. Courier names and sample rates are for demonstration only. Do not use sample AWBs or sample tracking events for real parcels.

## Run locally
Open `index.html` in a modern browser, or publish the folder to GitHub Pages for a public demonstration. GitHub Pages cannot host the secure backend needed for production.

## Production roadmap
1. Build a secure backend API and PostgreSQL database.
2. Add admin, staff and customer authentication with role permissions.
3. Convert booking to manual operational records with real AWB entry.
4. Add printable shipping labels and invoices.
5. Add audited manual tracking event entry.
6. Integrate courier APIs only after written authorization and credentials are obtained.
7. Add payment gateway and COD reconciliation after merchant onboarding.

Never put passwords, API secrets, OTPs or bank credentials in this public repository.
