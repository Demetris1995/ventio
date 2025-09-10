VENTIO — QUICK DEV SETUP (DOCKER)
=================================

What is this?
- Server: Vendure (Shop/Admin GraphQL)
- Web: Astro + React
- DB: Postgres (via Docker)
- Mail: MailHog (via Docker)
- PM: pnpm (monorepo)

Folder layout (just so you know)
- apps/vendure → server
- apps/web → web app
- packages/* → optional shared/reusable code
- scripts/ → handy GraphQL test files

Prereqs
-------
- Docker Desktop (Compose v2)
- Git
- VS Code (recommended)

VS Code (install these)
-----------------------
- ESLint
- Prettier
- Astro
- GraphQL (both “GraphQL” + “GraphQL syntax”)
- Tailwind CSS IntelliSense
- REST Client (optional, for /scripts/*.http)

1) Environment files
--------------------
Create two files:

apps/vendure/.env
-----------------
DB_HOST=db
DB_PORT=5432
DB_NAME=ventio_dev
DB_USER=postgres
DB_PASS=postgres

PORT=3000
ADMIN_API_PATH=/admin-api
SHOP_API_PATH=/shop-api

CORS_ORIGIN=http://localhost:4321
CORS_CREDENTIALS=true

SUPERADMIN_USERNAME=superadmin
SUPERADMIN_PASSWORD=Password1!

SMTP_HOST=mailhog
SMTP_PORT=1025

TYPEORM_SYNCHRONIZE=false

apps/web/.env
-------------
PUBLIC_SHOP_API_URL=http://localhost:3000/shop-api

2) Start everything
-------------------
If your repo already has a compose file, use it. If not, create docker-compose.yml at the repo root with this:

docker-compose.yml
------------------
version: "3.9"
services:
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: ventio_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    volumes: [ "pgdata:/var/lib/postgresql/data" ]

  mailhog:
    image: mailhog/mailhog
    ports: ["1025:1025","8025:8025"]

  vendure:
    build:
      context: .
      dockerfile: apps/vendure/Dockerfile.dev
    env_file: [ apps/vendure/.env ]
    working_dir: /workspace/apps/vendure
    command: ["pnpm","dev"]
    ports: ["3000:3000"]
    volumes:
      - .:/workspace
      - /workspace/node_modules
      - /workspace/apps/vendure/node_modules
    depends_on: [ db, mailhog ]

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile.dev
    env_file: [ apps/web/.env ]
    working_dir: /workspace/apps/web
    command: ["pnpm","dev","--host","0.0.0.0","--port","4321"]
    ports: ["4321:4321"]
    volumes:
      - .:/workspace
      - /workspace/node_modules
      - /workspace/apps/web/node_modules
    depends_on: [ vendure ]

volumes:
  pgdata:

Run:
docker compose up --build

3) Run DB migrations (first time only)
--------------------------------------
In another terminal:
docker compose exec vendure sh -lc "pnpm run migration:run"

(Any time you change entities/customFields, generate & run a migration:
pnpm run migration:generate -- --name my-change
pnpm run migration:run)

4) Open the app
---------------
- Admin UI (dashboard):  http://localhost:3000/admin
- Storefront:            http://localhost:4321

Note: /shop-api and /admin-api are **API endpoints** (GraphQL over HTTP). They are not meant to render in the browser. Use the scripts below, Postman/Insomnia, curl, or VS Code REST Client to call them.

Quick curl examples:
- Shop API introspection (example):
  curl -sS http://localhost:3000/shop-api -H "Content-Type: application/json" \
    -d "{\"query\":\"{ currentChannel { id code } }\"}"

- Admin login + use token (example):
  1) TOKEN=$(curl -sS http://localhost:3000/admin-api -H "Content-Type: application/json" \
       -d "{\"query\":\"mutation{ login(username:\\\"superadmin\\\",password:\\\"Password1!\\\"){ __typename ... on CurrentUser { id } } }\"}" | jq -r '.data.login')  # or use scripts below
  2) Use REST Client script instead (easier).

5) Quick multi-seller test (optional)
-------------------------------------
Open scripts/multi-seller.v3.http in VS Code (REST Client) and run the blocks to:
- create two sellers
- assign a variant to each seller channel
- add both variants to one cart
- get eligibleMethodsBySeller
- setShippingPerSeller
- transition to ArrangingPayment and see “Platform fee (10%)” surcharges

6) Common fixes
---------------
- CORS error (web → shop): check CORS_ORIGIN=http://localhost:4321, restart vendure.
- Empty shipping methods: ensure each seller channel has a Shipping Method assigned.
- No platform fee: transition order to ArrangingPayment after setting shipping.

7) Workspace essentials
-----------------------
Keep these at the repo root:

pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'

Also keep: pnpm-lock.yaml, .gitignore, .dockerignore, README.txt
