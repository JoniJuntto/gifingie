# Deploying to an UpCloud VPS with nginx

This app is a Bun/Turborepo monorepo:

- `apps/web`: React/Vite frontend, built into static files.
- `apps/server`: Bun/Elysia backend, listening on `localhost:3000`.
- `packages/db`: Drizzle migrations for PostgreSQL.

The deployment shape below keeps nginx in front, serves the built frontend directly, and proxies API traffic to the Bun server.

Domain used in these examples:

```bash
gifingie.huikaton.online
```

## 1. Point DNS at the VPS

In your DNS provider, create an `A` record:

```text
gifingie.huikaton.online  A  YOUR_UPCLOUD_SERVER_IPV4
```

Optional, if you use IPv6:

```text
gifingie.huikaton.online  AAAA  YOUR_UPCLOUD_SERVER_IPV6
```

Wait until DNS resolves:

```bash
dig +short gifingie.huikaton.online
```

## 2. Install system dependencies

SSH into the VPS:

```bash
ssh your-user@YOUR_UPCLOUD_SERVER_IP
```

Update packages:

```bash
sudo apt update
sudo apt upgrade
```

Install nginx, git, unzip, and curl:

```bash
sudo apt install nginx git unzip curl
```

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

Reload your shell:

```bash
source ~/.bashrc
```

Verify Bun:

```bash
bun --version
```

Create a stable system-wide Bun symlink for systemd:

```bash
sudo ln -sf "$(which bun)" /usr/local/bin/bun
```

## 3. Create the app folders

These instructions use your existing SSH/deploy user to own the files and run the service. That keeps future `git pull` deploys simple.

```bash
whoami
```

Create the app directory:

```bash
sudo mkdir -p /var/www/gifingie/app
sudo chown -R "$USER":"$USER" /var/www/gifingie
```

## 4. Clone the repo

From the VPS:

```bash
cd /var/www/gifingie/app
git clone YOUR_REPO_URL .
```

If the repo is private, set up an SSH deploy key or clone with your preferred authenticated Git method.

## 5. Create the production environment file

Create `/var/www/gifingie/app/.env`:

```bash
nano /var/www/gifingie/app/.env
```

Use this template:

```env
NODE_ENV=production

DATABASE_HOST=your-postgres-host
DATABASE_PORT=5432
DATABASE_USER=your-postgres-user
DATABASE_PASSWORD=your-postgres-password
DATABASE_NAME=your-postgres-database

BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
BETTER_AUTH_URL=https://gifingie.huikaton.online
CORS_ORIGIN=https://gifingie.huikaton.online

VITE_APP_URL=https://gifingie.huikaton.online
VITE_SERVER_URL=https://gifingie.huikaton.online

TWITCH_CLIENT_ID=your-twitch-client-id
TWITCH_CLIENT_SECRET=your-twitch-client-secret

GIPHY_API_KEY=your-giphy-api-key

# Required if you use direct GIF/image uploads.
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_UPLOAD_URL_TTL_SECONDS=300
S3_DISPLAY_URL_TTL_SECONDS=300
```

Generate a strong `BETTER_AUTH_SECRET`:

```bash
openssl rand -base64 48
```

Important database note: the current code connects to PostgreSQL with SSL enabled. That works well with managed PostgreSQL providers. If you run PostgreSQL locally on the VPS without SSL, either enable SSL for PostgreSQL or update the database connection code before deploying.

## 6. Configure Twitch OAuth

In the Twitch Developer Console, set the OAuth redirect URL to:

```text
https://gifingie.huikaton.online/api/auth/callback/twitch
```

Make sure the Twitch client ID and secret in `.env` match that Twitch application.

## 7. Install dependencies

From the repo root:

```bash
cd /var/www/gifingie/app
bun install --frozen-lockfile
```

## 8. Build the app

The frontend reads `VITE_*` values at build time, so build only after the production `.env` exists.

```bash
cd /var/www/gifingie/app
bun run build
```

Expected build outputs:

- Frontend: `/var/www/gifingie/app/apps/web/dist`
- Backend: `/var/www/gifingie/app/apps/server/dist/index.mjs`

## 9. Run database migrations

Run the checked-in Drizzle migrations:

```bash
cd /var/www/gifingie/app
bun run db:migrate
```

If this is the first deployment and migrations fail because the database is empty or out of sync, inspect the error before using `db:push`. `db:push` changes schema directly and is better kept for development unless you intentionally choose it.

## 10. Check the backend port

The backend currently listens on port `3000`.

Check whether another project is already using it:

```bash
sudo ss -tulpn | grep ':3000'
```

If port `3000` is already taken, either move the other project or update this app to read a `PORT` environment variable before deploying. nginx can proxy to any port, but this code currently has `3000` hardcoded in `apps/server/src/index.ts`.

## 11. Create a systemd service

Create the service file:

```bash
sudo nano /etc/systemd/system/gifingie.service
```

Paste:

```ini
[Unit]
Description=Gifingie Bun API
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/gifingie/app
EnvironmentFile=/var/www/gifingie/app/.env
ExecStart=/usr/local/bin/bun run apps/server/dist/index.mjs
Restart=always
RestartSec=5
User=YOUR_SSH_USER
Group=YOUR_SSH_USER

[Install]
WantedBy=multi-user.target
```

Replace `YOUR_SSH_USER` with the user printed by `whoami`.

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable gifingie
sudo systemctl start gifingie
```

Check logs:

```bash
sudo systemctl status gifingie
sudo journalctl -u gifingie -f
```

Quick local backend check:

```bash
curl http://127.0.0.1:3000/
```

Expected response:

```text
OK
```

## 12. Configure nginx

Create the nginx site:

```bash
sudo nano /etc/nginx/sites-available/gifingie.huikaton.online
```

Paste:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name gifingie.huikaton.online;

    root /var/www/gifingie/app/apps/web/dist;
    index index.html;

    client_max_body_size 12m;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /trpc/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/gifingie.huikaton.online /etc/nginx/sites-enabled/gifingie.huikaton.online
```

Test and reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Open:

```text
http://gifingie.huikaton.online
```

## 13. Add HTTPS with Certbot

Install Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
```

Issue the certificate:

```bash
sudo certbot --nginx -d gifingie.huikaton.online
```

Choose the redirect-to-HTTPS option when prompted.

Test renewal:

```bash
sudo certbot renew --dry-run
```

## 14. Verify production

Check the frontend:

```bash
curl -I https://gifingie.huikaton.online
```

Check the backend through nginx:

```bash
curl https://gifingie.huikaton.online/
```

Check an API route reaches Bun:

```bash
curl -I https://gifingie.huikaton.online/api/auth/session
```

A `200`, `204`, `401`, or auth-shaped response is fine. A `502` usually means the systemd service is down or nginx is proxying to the wrong port.

## 15. Deploy future updates

For each update:

```bash
cd /var/www/gifingie/app
git pull
bun install --frozen-lockfile
bun run build
bun run db:migrate
sudo systemctl restart gifingie
sudo systemctl reload nginx
```

Watch the logs after restarting:

```bash
sudo journalctl -u gifingie -f
```

## Troubleshooting

### nginx returns 502

Check that the Bun service is running:

```bash
sudo systemctl status gifingie
sudo journalctl -u gifingie -n 100
```

Check that port `3000` is listening:

```bash
sudo ss -tulpn | grep ':3000'
```

### Frontend loads but login/API calls fail

Confirm these values in `/var/www/gifingie/app/.env`:

```env
BETTER_AUTH_URL=https://gifingie.huikaton.online
CORS_ORIGIN=https://gifingie.huikaton.online
VITE_APP_URL=https://gifingie.huikaton.online
VITE_SERVER_URL=https://gifingie.huikaton.online
NODE_ENV=production
```

Then rebuild and restart:

```bash
bun run build
sudo systemctl restart gifingie
```

### Static routes return 404 after refresh

Make sure nginx has this line in `location /`:

```nginx
try_files $uri $uri/ /index.html;
```

### Uploads fail

If users can submit uploaded images or GIFs, the S3-compatible environment variables must be set. Also make sure your S3/CORS policy allows browser `PUT` uploads from:

```text
https://gifingie.huikaton.online
```

### Database connection fails

This app currently uses PostgreSQL SSL with `rejectUnauthorized: false`. Use a PostgreSQL endpoint that supports SSL, or adjust the database connection code if you run a local non-SSL PostgreSQL instance on the VPS.
