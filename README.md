# D&D 5e Dungeon Companion

A real-time web application that supports Dungeon Masters during D&D 5e campaigns. The DM runs sessions from a full dashboard, players join with a 6-character code and participate from their own devices.

---

## Features

- **DM authentication** — register and log in to manage campaigns
- **Campaign management** — create campaigns, build character rosters, write lore
- **Live sessions** — players join via a shareable 6-character code, no account required
- **Real-time combat** — initiative tracker, HP management, conditions, custom tags, combat log
- **DM validation queue** — every player action is approved, rejected, or modified by the DM before resolving
- **Action resolution** — direct attacks, multi-hit, and healing are auto-resolved; complex spells are DM-adjudicated via a tag system
- **Open-world phase** — DM pushes live lore cards to all players; players roll skill checks
- **Dice tray** — always accessible to all users
- **SRD monster library** — 300+ official monsters seeded from the open5e API

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Backend | Express 4 |
| Database | MongoDB 7 |
| Real-time | Socket.IO 4 |
| Frontend | SvelteKit 2 + Vite 5 |
| Auth | JWT (HttpOnly cookies) |
| Process manager | PM2 |

---

## Production Deployment on Ubuntu 24 LTS

### 1. System dependencies

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # should be 20.x
npm -v

# Install MongoDB 7
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
mongosh --eval "db.runCommand({ ping: 1 })"

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

---

### 2. Clone and configure

```bash
# Clone the repository
git clone <your-repo-url> /var/www/dungeon-tracker
cd /var/www/dungeon-tracker

# Set ownership
sudo chown -R $USER:$USER /var/www/dungeon-tracker
```

---

### 3. Environment variables

```bash
# Copy the example file
cp server/.env.example server/.env

# Edit with your values
nano server/.env
```

Required values in `server/.env`:

```env
PORT=3001
MONGO_URI=mongodb://127.0.0.1:27017/dungeon-tracker
JWT_SECRET=<generate a long random string — see below>
NODE_ENV=production
CLIENT_ORIGIN=http://54.37.230.173
```

Generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

### 4. Install dependencies

```bash
# Server dependencies
cd /var/www/dungeon-tracker/server
npm install --production

# Client dependencies
cd /var/www/dungeon-tracker/client
npm install
```

---

### 5. Seed the database

The seed script fetches the full SRD monster and spell list from the open5e API. Requires internet access on the VPS.

```bash
cd /var/www/dungeon-tracker/server
npm run seed
```

This will take 1–3 minutes. Run it only once. If the API is unavailable, a minimal fallback dataset is used automatically. The script is idempotent — safe to re-run.

---

### 6. Build the client

```bash
cd /var/www/dungeon-tracker/client
npm run build
```

The production build outputs to `client/build/`. The Express server serves this directory automatically when `NODE_ENV=production`.

---

### 7. Serve static files from Express

Add the following to `server/server.js` after your routes (already included if using this repository):

```js
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}
```

---

### 8. Start with PM2

```bash
cd /var/www/dungeon-tracker/server

# Start the server
pm2 start server.js --name dungeon-tracker

# Save PM2 process list so it survives reboots
pm2 save

# Set PM2 to start on boot (run the command it outputs)
pm2 startup

# View logs
pm2 logs dungeon-tracker

# Restart after changes
pm2 restart dungeon-tracker
```

---

### 9. Nginx reverse proxy

Create the Nginx config:

```bash
sudo nano /etc/nginx/sites-available/dungeon-tracker
```

Paste the following:

```nginx
server {
    listen 80;
    server_name 54.37.230.173;

    # Required for Socket.IO WebSocket connections
    proxy_buffer_size       128k;
    proxy_buffers           4 256k;
    proxy_busy_buffers_size 256k;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;

        # WebSocket upgrade headers — do not remove
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeout keeps Socket.IO connections alive
        proxy_read_timeout 86400;
    }
}
```

Enable the config:

```bash
sudo ln -s /etc/nginx/sites-available/dungeon-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### 10. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

### 11. Verify the deployment

```bash
# Server process running
pm2 status

# MongoDB running
sudo systemctl status mongod

# Nginx running
sudo systemctl status nginx

# Tail server logs
pm2 logs dungeon-tracker --lines 50

# API health check
curl http://54.37.230.173/api/auth/me
# Expected: 401 {"message":"Not authenticated"}
```

---

## Local Development

### Prerequisites

- Node.js 20+
- MongoDB running locally on port 27017

### Setup

```bash
# Clone
git clone <repo-url>
cd dungeon-tracker

# Install root dev dependencies
npm install

# Server
cd server
cp .env.example .env
# Edit .env — set JWT_SECRET to any string for dev
npm install
npm run seed     # seed monsters + spells (requires internet, ~2 min)

# Client
cd ../client
npm install
```

### Run

```bash
# From project root — starts server and client concurrently
npm run dev
```

| Service | URL |
|---|---|
| API server | `http://localhost:3001` |
| Client dev server | `http://localhost:5173` |

The Vite dev server proxies all `/api` and Socket.IO requests to Express automatically.

---

## Project Structure

```
dungeon-tracker/
├── server/
│   ├── config/
│   │   └── db.js                 MongoDB connection
│   ├── controllers/              Route handlers
│   ├── middleware/
│   │   └── auth.js               JWT verification
│   ├── models/
│   │   ├── User.js
│   │   ├── Campaign.js           Campaign + embedded players + lore
│   │   ├── Session.js            Live session (joinKey, phase, status)
│   │   ├── Monster.js            SRD monster library
│   │   ├── Spell.js              SRD spell library
│   │   ├── CombatSession.js      Real-time combat state
│   │   └── CustomCreature.js     DM-created custom creatures
│   ├── routes/                   Express REST routes
│   ├── socket/
│   │   ├── index.js              Socket.IO setup + auth middleware
│   │   ├── combatHandlers.js     All combat socket events
│   │   └── worldHandlers.js      World phase socket events
│   ├── seed.js                   SRD data seed script
│   └── server.js                 Entry point (HTTP + Socket.IO)
│
└── client/
    └── src/
        ├── routes/
        │   ├── +layout.svelte          Global nav + auth guard
        │   ├── +page.svelte            Landing page
        │   ├── login/+page.svelte
        │   ├── register/+page.svelte
        │   ├── dashboard/+page.svelte  Campaign list + create
        │   ├── campaign/[id]/          Campaign editor (players, lore)
        │   ├── join/[key]/             Player join screen
        │   └── session/[id]/           Live session — main interface
        └── lib/
            ├── api.js                  Fetch wrapper (SSR-safe)
            ├── socket.js               Socket.IO client singleton
            ├── stores/
            │   ├── auth.js             Auth state
            │   ├── combat.js           Combat state + derived stores
            │   └── session.js          Session state, roster, world feed
            └── components/
                ├── ui/                 HpBar, Tooltip
                ├── combat/             InitiativeTracker, CombatLog,
                │                       ActionPanel, ValidationQueue
                ├── world/              LoreCardPublisher, LoreCardFeed,
                │                       SkillCheckPanel
                └── dice/               DiceTray
```

---

## Session Flow

### Dungeon Master

1. Register at `/register`, log in at `/login`
2. Create a campaign at `/dashboard`
3. Add player characters and lore entries in the campaign editor at `/campaign/:id`
4. Click **Start Session** — generates a 6-character join code
5. Share the code: `54.37.230.173/join/ABC123`
6. Session opens at `/session/:id` with 4 tabs: **Combat**, **World**, **Characters**, **Lore**

### Players

1. Go to `54.37.230.173/join/ABC123` (or enter code on the landing page)
2. Enter a display name and select a character from the campaign roster
3. Land on the live session view — 3 tabs: **Combat**, **World**, **Characters**
4. During combat: action panel unlocks on your turn; actions require DM approval before resolving

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3001` | Express server port |
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `JWT_SECRET` | Yes | `dev-secret` | Secret for signing JWT tokens |
| `NODE_ENV` | No | `development` | Set to `production` to serve client build |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | CORS allowed origin |

---

## Updating in Production

```bash
cd /var/www/dungeon-tracker

git pull

# If server dependencies changed
cd server && npm install --production

# Rebuild client if frontend changed
cd ../client && npm install && npm run build

# Restart
pm2 restart dungeon-tracker
```

---

## Troubleshooting

**Socket.IO connections fail (websocket error in browser console)**
Ensure the `Upgrade` and `Connection` proxy headers are present in your Nginx config and that `proxy_http_version 1.1` is set. See Step 9.

**MongoDB not connecting**
```bash
sudo systemctl status mongod
sudo systemctl start mongod
journalctl -u mongod --no-pager | tail -20
```

**Seed script times out or fails**
The open5e API can be slow on first run. Simply re-run `npm run seed` — it uses upsert operations and is safe to run multiple times.

**`JWT_SECRET` not set warning in logs**
The server uses `'dev-secret'` as a fallback. This is insecure in production. Always set `JWT_SECRET` to a long random string in your `.env` file.

**Port already in use**
```bash
pm2 delete dungeon-tracker
pm2 start server.js --name dungeon-tracker
```

---

## SSL and Custom Domain

This section assumes the application is already running on `54.37.230.173` via HTTP and you now want to attach a domain name and serve over HTTPS.

### Prerequisites

- A registered domain (e.g. `yourdomain.com`) with an **A record** pointing to `54.37.230.173`
- DNS propagation confirmed: `dig yourdomain.com +short` should return `54.37.230.173`

### 1. Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Update the Nginx config for the domain

Edit `/etc/nginx/sites-available/dungeon-tracker` and replace the existing `server` block with:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Required for Socket.IO WebSocket connections
    proxy_buffer_size       128k;
    proxy_buffers           4 256k;
    proxy_busy_buffers_size 256k;

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;

        # WebSocket upgrade headers — do not remove
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Long timeout keeps Socket.IO connections alive
        proxy_read_timeout 86400;
    }
}
```

### 3. Obtain the SSL certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

Certbot will write the certificate paths into the Nginx config automatically if they are not already present.

### 4. Update the environment variable

Edit `server/.env` and change `CLIENT_ORIGIN` to use the domain over HTTPS:

```env
CLIENT_ORIGIN=https://yourdomain.com
```

Then restart the server:

```bash
pm2 restart dungeon-tracker
```

### 5. Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Verify

```bash
curl https://yourdomain.com/api/auth/me
# Expected: 401 {"message":"Not authenticated"}
```

Auto-renewal is handled by a systemd timer that Certbot installs automatically. Verify it is active:

```bash
sudo systemctl status certbot.timer
```

---

## License

MIT
