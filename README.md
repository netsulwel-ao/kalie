# Kalie — Super App de Angola

## Arrancar o projecto completo

```bash
# Na raiz do projecto: C:\dev\Netsulwel-Kalie
docker compose up --build
```

Isso sobe **tudo** de uma vez:

| Serviço | Container | URL |
|---------|-----------|-----|
| Frontend (React/Vite) | `kalie_frontend` | http://localhost |
| Backend (FastAPI) | `kalie_api` | http://localhost/api/v1 |
| Swagger UI | — | http://localhost/docs |
| PostgreSQL | `kalie_db` | porta interna 5432 |
| Redis | `kalie_redis` | porta interna 6379 |
| Nginx (proxy) | `kalie_nginx` | http://localhost:80 |

---

## Configuração antes de arrancar

O ficheiro `.env` na raiz já tem valores de desenvolvimento prontos a usar.  
Para produção, copia e preenche com os teus valores reais:

```bash
cp .env .env.prod
# edita .env.prod com os valores reais
```

Variáveis que **tens de preencher** para funcionalidades completas:

```env
# Firebase (login Google / telefone)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# Email (verificação de conta, reset de senha)
SMTP_USER=
SMTP_PASSWORD=

# Sulin (carteira digital)
SULIN_API_KEY=
```

---

## Comandos úteis

```bash
# Parar tudo
docker compose down

# Ver logs em tempo real
docker compose logs -f

# Logs só do backend
docker compose logs -f api

# Abrir shell no backend
docker compose exec api bash

# Correr migrações da base de dados
docker compose exec api alembic upgrade head

# Criar nova migração
docker compose exec api alembic revision --autogenerate -m "descricao"

# Abrir o PostgreSQL
docker compose exec db psql -U kalie_user -d kalie_dev

# Parar e apagar tudo (incluindo dados) — CUIDADO
docker compose down -v
```

---

## Estrutura do projecto

```
C:\dev\Netsulwel-Kalie\
├── docker-compose.yml      ← ponto de entrada único
├── .env                    ← variáveis de ambiente (não commitar)
├── Makefile                ← atalhos (make up, make logs, etc.)
├── backend/                ← FastAPI + Python
│   ├── app/
│   │   ├── api/v1/         ← rotas REST
│   │   ├── core/           ← config, segurança, JWT, Redis
│   │   ├── models/         ← SQLAlchemy (User, Wallet, Transaction)
│   │   ├── schemas/        ← Pydantic (validação)
│   │   └── services/       ← lógica de negócio
│   ├── alembic/            ← migrações da BD
│   └── docker/api/         ← Dockerfile + requirements.txt
├── frontend/               ← React 18 + TypeScript + Tailwind
│   ├── src/
│   │   ├── pages/          ← Feed, Jogos, Carteira, Auth
│   │   ├── components/     ← UI (glass-panel, botões, inputs)
│   │   ├── stores/         ← Zustand (auth, etc.)
│   │   └── services/       ← Axios + interceptors
│   └── Dockerfile.dev
├── docker/nginx/
│   └── dev.conf            ← proxy: / → frontend, /api → backend
└── games/                  ← Ludo, Xadrez (React)
```

---

## Hot reload

Tanto o frontend como o backend têm **hot reload** activo em desenvolvimento:
- **Frontend**: Vite HMR — guarda um ficheiro `.tsx` e o browser actualiza instantaneamente
- **Backend**: Uvicorn `--reload` — guarda um ficheiro `.py` e a API reinicia automaticamente
