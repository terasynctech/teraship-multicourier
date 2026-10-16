# TeraShip — Multi-Courier Management Demo

**TeraShip by TeraSyncTech** is a GitHub Pages-ready front-end prototype for demonstrating a multi-customer courier aggregator portal.

> **Important:** This is a demo only. Courier rates, AWBs, labels and tracking events are simulated. It is not connected to Blue Dart, DTDC, Delhivery, XpressBees, Ecom Express, India Post or any other courier network. Do not use it for real shipments or payments.

## Demo features

- Admin dashboard with shipment counts and courier distribution
- Create shipment form with sender/receiver details and customer account
- Six illustrative courier choices and sample rate comparison
- Local demo AWB generation and printable sample label
- Search/filter shipment register
- Tracking lookup with simulated event timeline and demo status progression
- Customer account directory, add customer and customer statement export
- Sample invoice register and payment status toggle
- COD register and reconciliation indicators
- CSV exports for shipments, COD, customers, courier performance and invoices
- Rebrandable portal name, company line and accent color
- Responsive layout for desktop and mobile
- Uses browser `localStorage` for demo changes; no backend required

## Publish with GitHub Pages

1. Create a new **public** GitHub repository named `teraship-multicourier` under your GitHub account/organization.
2. Upload all files and folders from this project. Keep the paths exactly as shown:
   - `index.html`
   - `css/style.css`
   - `js/app.js`
   - `README.md`
3. Open the repository **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then click **Save**.
6. Wait for the Pages deployment to finish. The URL should be:
   `https://YOUR-GITHUB-USERNAME.github.io/teraship-multicourier/`
7. Open the published URL in a new browser tab. No build tools or package installation are needed.

If your repository is under the `terasynctech` GitHub account, the likely URL is:
`https://terasynctech.github.io/teraship-multicourier/`

The URL will only work after the repository is created and GitHub Pages is enabled.

## How to demo to your client

1. Open **Dashboard** and explain that all couriers appear in one portal.
2. Open **Book a shipment**, select a customer, enter sample sender/receiver details, weight and COD if applicable.
3. Compare the six illustrative rates, choose one, and create a demo shipment.
4. A **TSDEMO** AWB is generated. Use the sample label button to view or print the clearly marked demo label.
5. Open **Track shipment**, paste the AWB and advance its status to show the tracking workflow.
6. Open **Customers**, add a retailer account, then open **Billing & COD** and **Reports**.
7. Export sample CSVs to demonstrate reporting.

Sample AWBs available by default:
- `TSDEMO100001`
- `TSDEMO100002`
- `TSDEMO100003`
- `TSDEMO100004`
- `TSDEMO100005`

## Demo data and browser storage

New demo records are stored in the current browser's local storage. The data does not automatically sync between users, devices or browsers. Use **Reports → Reset demo data** to restore seed records. Use this with care because it discards local demo changes.

## Production architecture (separate development phase)

GitHub Pages is static hosting. A production multi-courier system should be designed with a backend, database and security controls, for example:

- Frontend: React/Vue or structured HTML/JS app
- Backend: Node.js/Express, Django or another supported server framework
- Database: PostgreSQL or MySQL
- Authentication and roles: platform admin, branch staff, customer/retailer users
- Secure courier adapter layer: a separate server-side connector per approved carrier
- API credentials: environment variables or a secrets manager, never browser JavaScript or public GitHub
- Booking: live rate quote, PIN-code serviceability, shipment creation and label retrieval
- Tracking: carrier API polling/webhooks and event normalization
- Billing: customer rate cards, courier invoices, COD remittance reconciliation, GST/accounting requirements
- Operational controls: audit trail, backups, monitoring, access restrictions, privacy and retention policies

### Before connecting real courier companies

Confirm with each courier provider:
- API availability and account eligibility
- Written permission and credentials for booking, tracking, rates and labels
- Contracted rate card, volumetric-weight rules, fuel/GST/remote-area surcharges
- COD collection and remittance process
- Pickup and PIN-code serviceability rules
- Rate limits, webhook behavior, label format and production testing requirements

Do not assume that a Blue Dart franchise account automatically grants API rights or permission to resell/aggregate other courier services. Confirm terms with the relevant providers.

## Project structure

```text
teraship-multicourier/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── README.md
```

## License

Demonstration template for evaluation and customization by TeraSyncTech. Add your chosen license before redistributing.
