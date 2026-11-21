## Membership approvals and five-month installments

Run `supabase/membership-months-migration.sql` in the Supabase SQL Editor after the base schema and payout-details migration. Admins can open the **Approvals & monthly payments** link from the admin dashboard to review member application details, approve pending applications, and mark each verified installment paid. Approval creates five monthly installments of ₦15,000 (₦75,000 total); the dashboard totals recorded paid installments and shows remaining months.

Members continue using public email/password signup and login. Their member home includes a **Membership payments** shortcut. The page shows their application approval state, five-month schedule, paid installments, and months remaining. Members can read only their own schedule; only admins can approve applications or update payment status. This tracker records payment confirmations and does not process payments.
