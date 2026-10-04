# Sortd monorepo

Customer storefront, staff admin UI, and Django API in one repo.

```text
backend/    Django + Ninja API
frontend/   Next.js customer storefront (port 3000)
admin/      Next.js staff console (port 3001)
```

## Backend

Local defaults to SQLite. PostgreSQL is what production uses.

```powershell
docker compose up -d
```

Then in `backend/.env`:

```text
DATABASE_URL=postgres://sortd:sortd@127.0.0.1:5432/sortd
```

```powershell
cd backend
..\.venv\Scripts\python.exe src\manage.py migrate
..\.venv\Scripts\python.exe src\manage.py runserver 8000
```

Create a staff user for the Next.js admin app:

```powershell
..\.venv\Scripts\python.exe src\manage.py createsuperuser
```

`createsuperuser` marks email verified. Staff (`is_staff=True`) use the Next.js admin on port 3001; Django’s built-in `/admin/` UI is not enabled.

## Cloudinary

Product images are public CDN assets. Lab-report PDFs stay private (`authenticated` + raw) and are streamed through the API, not a public URL.

Leave `CLOUDINARY_*` empty locally to store files on disk under `backend/media/`. Production requires all three:

```text
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
PUBLIC_API_ORIGIN=http://127.0.0.1:8000
```

Upload images from the admin product page (JPEG / PNG / WebP, 5 MB).

## Seed catalog

Homepage products from the SORTD shop screenshot live in `backend/src/catalog/data/storefront_products.json`.

```powershell
cd backend
..\.venv\Scripts\python.exe src\manage.py import_catalog
..\.venv\Scripts\python.exe src\manage.py import_catalog --dry-run
```

The command is idempotent: re-running updates titles, prices, stock, pack offers, flavour links, and label data by slug/SKU.

## Storefront

```powershell
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

`SERVICE_SIGNING_KEY` must match the backend value. The browser never sees that key; Server Actions mint a short-lived service JWT.

## Admin UI

```powershell
cd admin
copy .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3001

Use a staff account (`is_staff=True`). All admin work goes through `/api/v1/admin/...` on the same Django API.

## Auth headers

| Caller | Header | Value |
|---|---|---|
| Storefront / Admin Next servers | `X-Service-Token` | HS256 JWT (`iss=storefront` or `iss=admin`) |
| Logged-in customer/staff | `Authorization: Bearer` | User access JWT from Django |

CORS stays closed. Next.js talks to Django server-side.

## Email

Signup sends a magic-link to `FRONTEND_URL/verify-email?token=...`. Locally, Django prints that mail to the runserver console unless you set Brevo or SMTP.

Brevo (Anymail API) in `backend/.env`:

```text
BREVO_API_KEY=<v3 API key from SMTP & API → API Keys>
EMAIL_BACKEND=anymail.backends.brevo.EmailBackend
DEFAULT_FROM_EMAIL=Sortd <hello@your-verified-domain>
```

SMTP (Resend, SendGrid, SES) also works via `EMAIL_HOST`. `DEFAULT_FROM_EMAIL` must be a verified sender, and `FRONTEND_URL` must be the public storefront origin so the link opens the live site.

```powershell
cd backend
..\.venv\Scripts\python.exe src\manage.py sendtestemail you@example.com
```

Do not deploy until that test message arrives. Hosting can be chosen after email is confirmed.
