# Telectro Membership Demo

A responsive public website for Telectro's five-month membership and separate affiliate program.

## Membership

- ₦75,000 membership fee
- Five-month membership period
- 1 mobile phone after payment approval
- 3 power banks after payment approval
- Delivery to the address supplied by the member
- Bank-transfer receipt sent through WhatsApp

## Affiliate program

The affiliate application is separate from membership. Demo users can submit a request and open WhatsApp with a prefilled message.

## Demo limitations

This version is a static frontend demo:

- It does not store personal or payment data
- It does not create real accounts or passwords
- It does not verify transfers
- It does not send receipts to the admin email
- It uses a placeholder WhatsApp number

## Run locally

Open `index.html` directly or run:

```bash
python3 -m http.server 4173
```

## Deploy to Vercel

Import this repository in Vercel. No build command is required for this static demo.

## Before launch

- Replace `2348000000000` with the real WhatsApp number
- Add bank account details
- Add approval and authentication backend
- Add database storage and password reset
- Add delivery status and five-month expiry tracking
- Add terms, refund and privacy policies
