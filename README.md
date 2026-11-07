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


## Supabase authentication setup (Stage 2)
The project now includes a Supabase sign-in gate. It uses the project URL and browser-safe publishable key in `js/supabase-config.js`. The key is not a secret; never place a Supabase secret/service-role key in this repository.

The login gate checks `public.profiles` and permits only profiles with role `admin` or `staff`. Your first administrator profile must already exist in Supabase. The existing dashboard modules are still prototype/local-storage modules at this stage; customer and shipment CRUD will be migrated to the database in the next development stage. Do not use this build for live shipment operations yet.

Publish the complete folder contents to the GitHub Pages repository, preserving the `css` and `js` folders. For Vercel, import the repository and deploy the project root as a static site.
