# DeathSwitch Backend

AI-powered crypto inheritance DApp backend on the Mantle blockchain.

## Local Setup

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- A funded wallet on Mantle Sepolia (testnet) or Mantle Mainnet

### Steps

1. Install dependencies:
   ```bash
   cd deathswitch-backend
   npm install
   ```

2. Copy and configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. Start PostgreSQL:
   ```bash
   docker-compose up postgres -d
   ```

4. Run database migrations:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

5. Compile contracts:
   ```bash
   npx hardhat compile
   ```

6. Run contract tests:
   ```bash
   npx hardhat test
   ```

7. Deploy to Mantle Sepolia testnet:
   ```bash
   npm run deploy:testnet
   # Copy the FACTORY_CONTRACT_ADDRESS from output into .env
   ```

8. Start the API in dev mode:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`.

---

## Contract Addresses

| Network | Contract | Address |
|---|---|---|
| Mantle Sepolia (testnet) | DeathSwitchFactory | *(run deploy:testnet and add here)* |
| Mantle Mainnet | DeathSwitchFactory | *(run deploy:mainnet and add here)* |

---

## API Route Table

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | No | Health check |
| POST | /auth/nonce | No | Generate SIWE nonce for wallet |
| POST | /auth/verify | No | Verify SIWE signature, returns JWT |
| GET | /switch | Yes | Get switch config + on-chain status |
| POST | /switch/create | Yes | Deploy new switch contract on-chain |
| PATCH | /switch/settings | Yes | Update notification email/phone |
| GET | /beneficiaries | Yes | List all beneficiaries |
| POST | /beneficiaries | Yes | Add beneficiary (on-chain + DB) |
| DELETE | /beneficiaries/:id | Yes | Remove beneficiary (on-chain + DB) |
| POST | /checkin | Yes | Alive ping — calls checkIn() on-chain |
| GET | /assets | Yes | On-chain balances with USD prices |

All protected routes require `Authorization: Bearer <jwt>` header.

All responses follow `{ success: boolean, data?: any, error?: string }`.

---

## Watchdog Service

The watchdog cron job runs inside the API server process every **1 minute**.

It scans all switches with `status = ACTIVE | GRACE_PERIOD` and `nextCheckInDue < now`, then applies escalation stages (thresholds scale with each switch's own grace period):

| Stage | Trigger | Action |
|---|---|---|
| 0 | Overdue | Daily reminder email (repeats every 24h) |
| 1 | Overdue (first) | Overdue email; status → `GRACE_PERIOD` |
| 2 | 50% of grace elapsed | Urgent reminder email |
| 3 | 90% of grace elapsed | Final notice email |
| 4 | On-chain trigger deadline passed | Calls `trigger()` on-chain |

Emails are sent via **Resend** (HTTPS API) when configured, falling back to Gmail SMTP. The watchdog is **idempotent**: it checks `escalationStage` and `NotificationLog` before sending to avoid duplicates. Failed on-chain calls are retried 3 times with exponential backoff; if all retries fail, an admin alert email is sent.

### Keeping the watchdog alive on Render free tier

Render's free tier **spins the service down after ~15 min of inactivity**, and the watchdog cron does **not** run while spun down — so triggers/emails would be delayed until the next request wakes it.

Two layers guard against this:

1. **Built-in self-ping** (`src/services/keepAlive.ts`): once running, the process pings its own `/health` every 10 minutes (using `RENDER_EXTERNAL_URL`, which Render injects automatically). Self-requests count as inbound traffic, so the service stays awake and the watchdog keeps ticking.
2. **External uptime pinger (recommended backup):** configure a free service such as [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com) to GET `https://<your-app>.onrender.com/health` every 5 minutes. This wakes the service even if the process itself ever goes fully down (which the internal self-ping cannot recover from).

For guaranteed always-on triggering, upgrade to a paid Render instance or run the watchdog as a separate always-on background worker.

---

## Frontend Integration

The frontend (`DeathSwitch Legacy.html`) is a self-contained React app. Serve it from any static host and point it at this API:

1. The frontend uses `http://localhost:3001` as the API base URL in development.
2. Auth flow: wallet signs an EIP-4361 (SIWE) message → POST `/auth/verify` → stores JWT.
3. All subsequent requests include `Authorization: Bearer <jwt>`.

For production, update the API base URL in the frontend bundle and configure CORS in the API.

---

## How to Go Live on Mantle Mainnet

1. Ensure the backend wallet has MNT for gas fees.
2. Set `NODE_ENV=production` in `.env`.
3. Set `MANTLE_RPC_URL=https://rpc.mantle.xyz`.
4. Deploy the factory contract:
   ```bash
   npm run deploy:mainnet
   ```
5. Update `FACTORY_CONTRACT_ADDRESS` in `.env` with the mainnet address.
6. Verify the contract on the Mantle explorer:
   ```bash
   npx hardhat run scripts/verify.ts --network mantle_mainnet
   ```
7. Start with Docker Compose:
   ```bash
   docker-compose up -d
   ```
