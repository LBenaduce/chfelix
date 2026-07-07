# Supabase setup

This project uses a private Storage bucket named `guest-photos`.

## Storage policies

Run `supabase/storage-policies.sql` in the Supabase SQL editor.

Expected behavior:
- anonymous visitors can upload only to `pending/`
- anonymous visitors can read only from `approved/`
- only the `gallery-admin` Edge Function can list, approve, or reject pending media

## Edge Function

Deploy the function:

```sh
supabase functions deploy gallery-admin
```

Set these secrets in Supabase:

```sh
supabase secrets set GALLERY_ADMIN_USER=CARLOSHENRIQUE
supabase secrets set GALLERY_ADMIN_PASSWORD_HASH=22ed5a7a4d808106ceedad5208b9d3c2915568b5c7bc6093389b43b8434e77e4
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase in the function runtime. Never put the service role key in frontend code.
