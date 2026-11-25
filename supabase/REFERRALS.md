# Telectro referral rewards

Run `supabase/referral-rewards-migration.sql` in the Supabase SQL editor after the core schema and payout migration. It creates referral codes and credits and enforces the fixed ₦10,000 credit only after an administrator approves the referred member's application and confirms payment. Signup must preserve the invite code; `supabase-config.js` reads it from `?ref=CODE` and submits it as Auth user metadata.

The member dashboard shows pending and earned referral credits. This is not a cash-prize wheel: it does not promise random cash prizes or a vehicle. Publish complete eligibility, privacy, reward redemption, and payout terms before promoting rewards. Do not treat pending credits as payable until verification and the published terms are satisfied.
