# Project Structure

## Root Layout

```
/
├── frontend/          # React + TypeScript SPA (PWA)
├── backend/           # Python FastAPI services
├── games/             # Game implementations
│   ├── chessGame/     # Chess (vanilla JS — to be rewritten in React)
│   └── LudoPlay/      # Ludo (React/TSX, multiplayer-ready)
├── template/          # UI mockups and design references (HTML prototypes)
│   └── nexus/         # DESIGN.md — Kalie design system spec
├── .kiro/
│   └── steering/      # AI steering rules (this folder)
├── project.md         # High-level project vision and roadmap
└── base.md            # Architecture and infrastructure reference
```

## Frontend Structure (target)

```
frontend/
├── src/
│   ├── components/
│   │   └── ui/        # Shared UI primitives (button, avatar, input, etc.)
│   ├── pages/         # Route-level page components
│   ├── stores/        # Zustand stores (authStore, walletStore, etc.)
│   ├── services/      # API client (axios instance + extractApiError)
│   ├── hooks/         # Custom React hooks
│   ├── i18n/          # Translation files (pt-AO primary)
│   └── modules/       # Feature modules (feed, games, wallet, sos, etc.)
├── public/
└── index.html
```

## Backend Structure (target)

```
backend/
├── app/
│   ├── main.py        # FastAPI entry point
│   ├── core/          # Config, security, JWT, dependencies
│   ├── db/            # Database session, base model
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic schemas
│   ├── api/           # Route handlers grouped by module
│   │   ├── auth/
│   │   ├── wallet/
│   │   ├── games/
│   │   ├── social/
│   │   └── ...
│   └── services/      # Business logic layer
├── alembic/           # DB migrations
├── docker/
│   └── api/
│       ├── Dockerfile
│       └── requirements.txt
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.staging.yml
├── docker-compose.prod.yml
├── Makefile
└── .env.*             # Never committed to git
```

## Games Structure

```
games/
├── chessGame/         # Legacy vanilla JS — migrate to React
│   ├── index.html
│   └── src/js/script.js
└── LudoPlay/          # Active React implementation
    ├── LudoPlay.tsx   # Main game component (multiplayer, WebSocket)
    ├── LudoBoard.tsx  # Board rendering
    ├── gameLogic.js   # Board positions, paths, player state
    ├── assets.js      # Dice animation frames
    └── useGameEngine.js
```

## Templates

The `template/` folder contains standalone HTML prototypes for each module. These are design references only — not production code. Use them to understand the intended UI/UX before implementing in React.

| Folder | Module |
|--------|--------|
| `arena_de_jogos_e_sorteios_nexus` | Games & Raffles arena |
| `bisno_r_pido_nexus_marketplace` | Bisno Rápido (gig jobs) |
| `carteira_do_usu_rio_nexus` | Digital wallet |
| `chatbot_social_hub_nexus` | Social chat hub |
| `feed_central_nexus_super_app` | Main social feed |
| `hub_de_torneios_nexus` | Tournament hub |
| `mapa_imersivo_3d_nexus` | 3D immersive map |
| `painel_sos_nexus_super_app` | SOS panel |
| `rifas_e_leil_es_nexus` | Raffles & auctions |

## Conventions

- **Language**: all UI text and user-facing strings in Portuguese (pt-AO) via i18n keys
- **File naming**: React components in PascalCase (`.tsx`), utilities/hooks in camelCase (`.ts`)
- **API routes**: REST under `/api/v1/`, WebSocket under `/ws/`
- **Secrets**: never hardcode — always reference via environment variables
- **Games**: backend is source of truth for game state; frontend handles animation/audio only
- **Modules**: each super app module is self-contained under `src/modules/<module-name>/`
