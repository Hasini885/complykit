<p align="center">
  <img src="public/brand/ca-compliance-tool-logo-transparent.png" alt="CA Compliance Tool" width="180" />
</p>

<h1 align="center">CA Compliance Tool</h1>

<p align="center">
  <strong>Live: <a href="https://cacompliancetool.com">cacompliancetool.com</a></strong>
</p>

CA Compliance Tool is one workspace for a CA or CS practice in India. It covers Companies Act (MCA) filings and due dates, GST clients and return status, late fees, documents, bank statements and the firm's task list, so you don't have to track them across Excel sheets.

## The six tools

The dashboard opens on six tools. The top bar shows only the pages of the tool that's open, and the menu button lists every tool.

### MCA

- **Dashboard:** post-incorporation and annual compliance tables for every company (AOC-4, MGT-7/7A, ADT-1, DPT-3, INC-20A, DIR-3 KYC, ITR and more), with overdue and upcoming filings and a compliance calendar.
- **Due dates worked out for you** from each company's incorporation date, AGM, financial year and auditor appointment, including first and subsequent auditor ADT-1.
- **Company Master Data:** a four-step company form (master data, directors and authorised person, consultant, applicability of special forms).
- **Import from MCA master data:** upload the MCA master data PDF or Excel and the company details (CIN, capital, registered office, email) and directors fill in. Scanned or "Print to PDF" files are read with in-browser OCR. Several files can be uploaded at once, and companies already added are skipped.
- **Challan upload:** upload MCA challans or ITR acknowledgements and the tool reads the SRN or acknowledgement number, matches the company and form, and marks the filing as filed. Handles batches and warns about duplicates.
- **Director Master and Consultant Master:** each director once by DIN with every company they sit on and their KYC status; consultants with their companies. PDF and Excel reports.

### Late Fee Calculator

Late fee for every ROC form (AOC-4, MGT-7/7A, ADT-1, DPT-3, DIR-12, PAS-3, MGT-14, CHG-1 ad valorem, DIR-3 KYC, MSME-1 and more) and ITR, with a quick compare.

### GST

- **Client Register:** GST clients with GSTIN, portal user name and password (masked until shown), registration details and folder.
- **Return Filing Status:** GSTR-1 and GSTR-3B filed or not, month by month, for every client.
- **GST Helper (free Chrome extension):** fills the GST portal login for you (you type the captcha) and checks every client's filing status from the public Search Taxpayer page. Download it from the Helper Guide page; the source is in `extensions/gst-helper`.

### Document Generator

Board and general meeting notices, resolutions, DIR-2, DIR-8, MBP-1 and letters, pre-filled from the company's details and downloaded as Word or PDF.

### Bank Statement to Excel

Converts a bank statement PDF into a spreadsheet and lets you tag each transaction to a ledger before downloading.

### Task Manager

Every client task with assignee, deadline, fee and status (Pending, Client Pending, Officer Pending, Finished). Sort, filter, drag rows into your own order, and see overdue counts on the dashboard.

## Also included

- **Excel-style sheets** across the GST and Task Manager pages, with Excel export.
- **Accounts and sync:** sign in with Clerk. Your data is saved privately to your account and appears on any device; the account's saved copy always wins. Export and import everything as JSON.
- **Install as an app and use offline:** the site installs as a PWA. Pages are kept on the device, the last signed-in account's data opens without internet, and changes are saved to the account when you're back online. Signing out clears it.
- **Reference:** forms, sections, applicability checks, incorporation and checklists.

## Privacy

Uploaded PDFs and Excel files are read in your browser and aren't sent to a third-party API. No other user can see your client data. GST portal passwords are stored only in your account's data; the GST Helper holds them for at most three minutes to fill the login form.

## Built with

- Next.js 16 (App Router) and React 19, written in JavaScript
- Tailwind CSS v4 and shadcn/ui
- Clerk for authentication
- pdf.js, Tesseract.js (OCR) and read-excel-file for in-browser document reading; docx, jsPDF and write-excel-file for downloads
- Vercel for hosting, with Vercel Blob for private account storage

## Running locally

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # unit tests
npm run lint           # eslint
npm run build          # production build
npm run zip:extension  # rebuild public/downloads/gst-helper.zip after editing the extension
```

Create a `.env.local` with:

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Sign-in |
| `BLOB_READ_WRITE_TOKEN` | Saving account data to Vercel Blob |
| `ADMIN_EMAILS` | Optional: comma-separated emails that can open `/admin/users` |
| `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` | Optional: AI fallback for scanned PDFs on the Applicability page. Without it, nothing is sent to an AI service |
| `KIT_API_KEY`, `KIT_FORM_ID` | Optional: newsletter sign-up |

Never commit `.env*` files.

## Disclaimer

CA Compliance Tool is a reference tool for general information only and is not legal or professional advice. Always check due dates and requirements against the Companies Act, the GST law, the Rules and the official MCA and GST portals.

© 2026 CA Compliance Tool. All rights reserved.
