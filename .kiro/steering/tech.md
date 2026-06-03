# Tech Stack

## Frontend
- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Routing**: React Router v6 (`useParams`, `useNavigate`, `useBlocker`)
- **State Management**: Zustand (`useAuthStore`, etc.)
- **i18n**: react-i18next
- **Icons**: lucide-react
- **UI Components**: custom component library (`components/ui/button`, `components/ui/avatar`, etc.)
- **PWA**: Service Worker for offline support
- **Auth**: WebAuthn (biometrics), Google login, phone number login

## Backend
- **Framework**: Python + FastAPI
- **Database**: PostgreSQL (ACID, financial data) + Alembic migrations
- **Cache / Queues**: Redis
- **Auth**: JWT (access + refresh tokens), Firebase Auth, 2FA
- **Real-time**: WebSockets (game state, chat)
- **Email**: Hostinger SMTP

## Infrastructure
- **Containerization**: Docker + Docker Compose
- **Environments**: dev / staging / prod via compose overrides
  - `docker-compose.yml` (base)
  - `docker-compose.dev.yml` — hot reload, verbose logs
  - `docker-compose.staging.yml` — HTTPS, rate limiting
  - `docker-compose.prod.yml` — no debug, `restart: always`
- **API Gateway**: Nginx / Traefik (TLS 1.3, WAF, rate limiting)
- **Future**: Firebase (KYC), Prometheus + Grafana, CI/CD via GitHub Actions

## Security Requirements
- No hardcoded secrets — always use `.env` files
- JWT + bcrypt password hashing
- Rate limiting + brute force protection on all auth endpoints
- WAF rules: XSS, SQL injection, CSRF
- Provably Fair (HMAC-SHA256) for games, raffles, and auctions
- Immutable audit log (HMAC-signed) for all financial transactions
- Row-level security on PostgreSQL for financial data
- Docker network isolation — services communicate by container name, never `localhost`

## Payments
- **Sulin** — primary external wallet (Kwanza / AOA)
- **EMIS / Multicaixa Express** — future local payment integration

## Common Commands

```bash
# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Staging
docker compose -f docker-compose.yml -f docker-compose.staging.yml up

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up

# Makefile shortcuts (when available)
make dev
make staging
make prod

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# Frontend (run manually — do not use watch mode in agent)
npm run dev        # development server
npm run build      # production build
npm run lint       # ESLint
```

## Environment Files
- `.env.dev` / `.env.staging` / `.env.prod` — never commit to git
- Key vars: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `FIREBASE_*`, `SULIN_*`
