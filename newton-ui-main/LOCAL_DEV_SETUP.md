# Local Dev Setup

These steps are required once per machine to run the dev server locally with auth working correctly.

## Why this is needed

The BFF at `gotalk.dev` sets an `httpOnly` cookie scoped to `.gotalk.dev`. Browsers only send this cookie to `*.gotalk.dev` — not to `localhost`. Running the dev server on `local.gotalk.dev` (a real subdomain mapped to 127.0.0.1) lets the browser include the cookie on all API requests.

---

## 1. Add local DNS entry

```bash
sudo sh -c 'echo "127.0.0.1 local.gotalk.dev" >> /etc/hosts'
```

## 2. Generate a trusted local SSL certificate

```bash
brew install mkcert        # skip if already installed
mkcert -install            # trust the local CA (one-time)

mkdir -p certs
mkcert -key-file certs/local.gotalk.dev-key.pem \
       -cert-file certs/local.gotalk.dev.pem \
       local.gotalk.dev
```

> `certs/` is gitignored — each developer generates their own.

## 3. Create `.env.local`

Create a file called `.env.local` in the project root (it is gitignored):

```env
VITE_API_BASE_URL=https://local.gotalk.dev:5175/api
VITE_DEV_HTTPS=true
VITE_DEV_PORT=5175
```

With `VITE_DEV_HTTPS=true`, `vite.config.ts` enables HTTPS when `certs/local.gotalk.dev*.pem` exist (see step 2). Port comes from `VITE_DEV_PORT`.

## 4. Run the dev server

```bash
npm run dev
```

Open **https://local.gotalk.dev:5175** in your browser.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ENOENT: certs/local.gotalk.dev-key.pem` | Re-run step 2 |
| `Port 5175 is already in use` | Change `VITE_DEV_PORT` in `.env.local` or free the port |
| Browser shows cert warning | Run `mkcert -install` again and restart the browser |
| Login redirects to wrong URL | Ensure `redirect_uri` / OAuth app allowlist includes your dev origin (e.g. `https://local.gotalk.dev:5175`) — the app uses `window.location.origin` |
