# Product: Kalie Super App

Kalie é o Super App angolano — uma plataforma única que combina serviços sociais, financeiros, de jogos e utilitários para utilizadores angolanos. O sistema é totalmente em Português (pt-AO) e orientado para utilizadores mobile-first em Angola.

## Core Modules

- **Feed Social** — social feed with posts, reactions, and chat (with or without AI)
- **Jogos & Torneios** — board games (Ludo, Xadrez, Damas, Tic-Tac-Toe) with multiplayer and tournament brackets (quarter-finals, semi-finals, finals)
- **Carteira Digital** — digital wallet with Kwanza (AOA) support, payments via Sulin (external wallet)
- **Rifas & Leilões** — raffles and auctions with Provably Fair cryptographic fairness
- **Bisno Rápido** — quick jobs / gig marketplace
- **SOS** — emergency assistance panel
- **Mapa & Eventos** — immersive map with local events
- **Hub de Torneios** — tournament management hub
- **Achados e Perdidos** — lost and found

## Key Principles

- **Angola-first**: currency is Kwanza (AOA), language is Portuguese, payment integrations are local (Sulin, EMIS/Multicaixa Express)
- **Security first**: XSS, SQL injection, brute force, rate limiting, load balancing, JWT + 2FA, Provably Fair in games and raffles
- **Mobile-first PWA**: offline support via Service Worker, biometric auth (WebAuthn)
- **Incremental delivery**: build phase by phase — auth → wallet → games → social → marketplace

## Design System (Kalie)

- Dark-first glassmorphism UI with backdrop blur and luminous edges
- Module accent colors: SOS=Safety Orange, Bisno=Electric Cyan, Games/Rifas=Neon Purple+Gold, Feed=Emerald Green
- Typography: Space Grotesk (headings) + Inter (body)
- Corner radii: 24–32px cards, pill buttons, 16px inputs
- 8px spacing unit, 24px container padding
