# VENTIO — DEVELOPMENT README (DOCKER-FOCUSED)

## STACK

• Server: Vendure v3.4.x (NestJS, TypeORM, PostgreSQL)
• Web: Astro + React (Tailwind)
• Package manager: pnpm (workspaces)
• Dev infra: Docker (PostgreSQL, MailHog, optional Redis)

## REPO LAYOUT

apps/
vendure/                    ← Vendure app (project-specific)
src/plugins/marketplace/  ← Marketplace plugin (seller channels, shipping, fees)
web/                        ← Astro + React storefront
src/components/blocks/    ← UI blocks (e.g., MultiSellerShipping)
src/pages/checkout/       ← Pages (e.g., shipping.astro)
src/pages/api/checkout/   ← Astro server routes (GraphQL proxy)
packages/
vendure-plugins/            ← Reusable plugins (generic integrations)
scripts/
multi-seller.v3.http        ← Click-run GraphQL tests (VS Code REST Client)

## PREREQUISITES

• Windows 10/11, macOS, or Linux
• Docker Desktop (with Docker Compose v2)
• Git
• Node.js 20 LTS + pnpm (only if you run apps locally instead of inside Docker)

* Install pnpm:  npm i -g pnpm
  • VS Code (recommended); see “Editor Setup” section

## ENVIRONMENT VARIABLES

Create these files (copy/paste exactly, then adjust passwords if needed).

## apps/vendure/.env

DB\_HOST=db
DB\_PORT=5432
DB\_NAME=ventio\_dev
DB\_USER=postgres
DB\_PASS=postgres

PORT=3000
ADMIN\_API\_PATH=/admin-api
SHOP\_API\_PATH=/shop-api

CORS\_ORIGIN=[http://localhost:4321](http://localhost:4321)
CORS\_CREDENTIALS=true

SUPERADMIN\_USERNAME=superadmin
SUPERADMIN\_PASSWORD=Password1!

SMTP\_HOST=mailhog
SMTP\_PORT=1025
SMTP\_USER=
SMTP\_PASS=

TYPEORM\_SYNCHRONIZE=false

## apps/web/.env

PUBLIC\_SHOP\_API\_URL=[http://localhost:3000/shop-api](http://localhost:3000/shop-api)

## DOCKER COMPOSE (RECOMMENDED)

We support two modes:

A) Infra-only in Docker (DB, MailHog, Redis), run apps locally with pnpm
B) Full dev-in-docker (apps + infra)

If your repo already contains docker-compose files, use them. Otherwise, create these two files at repo root:

## compose.infra.yml  (infrastructure only)

version: "3.9"
services:
db:
image: postgres:14
environment:
POSTGRES\_DB: ventio\_dev
POSTGRES\_USER: postgres
POSTGRES\_PASSWORD: postgres
ports:
\- "5432:5432"
volumes:
\- pgdata:/var/lib/postgresql/data
healthcheck:
test: \["CMD-SHELL","pg\_isready -U postgres -d ventio\_dev"]
interval: 5s
timeout: 5s
retries: 20

mailhog:
image: mailhog/mailhog
ports:
\- "1025:1025"  # SMTP
\- "8025:8025"  # Web UI [http://localhost:8025](http://localhost:8025)

redis:
image: redis:7
ports:
\- "6379:6379"

volumes:
pgdata:

## compose.dev.yml  (apps + infra with hot-reload)

version: "3.9"
services:
db:
extends:
file: compose.infra.yml
service: db
mailhog:
extends:
file: compose.infra.yml
service: mailhog
redis:
extends:
file: compose.infra.yml
service: redis

vendure:
build:
context: .
dockerfile: apps/vendure/Dockerfile.dev
env\_file:
\- apps/vendure/.env
working\_dir: /workspace/apps/vendure
command: \["pnpm","dev"]
ports:
\- "3000:3000"
volumes:
\- .:/workspace
\- /workspace/node\_modules
\- /workspace/apps/vendure/node\_modules
depends\_on:
\- db
\- mailhog

web:
build:
context: .
dockerfile: apps/web/Dockerfile.dev
env\_file:
\- apps/web/.env
working\_dir: /workspace/apps/web
command: \["pnpm","dev","--host","0.0.0.0","--port","4321"]
ports:
\- "4321:4321"
volumes:
\- .:/workspace
\- /workspace/node\_modules
\- /workspace/apps/web/node\_modules
depends\_on:
\- vendure

Create dev Dockerfiles:

## apps/vendure/Dockerfile.dev

FROM node:20
RUN corepack enable && corepack prepare pnpm\@latest --activate
WORKDIR /workspace
COPY package.json pnpm-lock.yaml ./
COPY apps/vendure/package.json apps/vendure/
COPY apps/web/package.json apps/web/
COPY packages/vendure-plugins/package.json packages/vendure-plugins/ || true
RUN pnpm install --frozen-lockfile
COPY . .
WORKDIR /workspace/apps/vendure
EXPOSE 3000

# “pnpm dev” provided by compose command

## apps/web/Dockerfile.dev

FROM node:20
RUN corepack enable && corepack prepare pnpm\@latest --activate
WORKDIR /workspace
COPY package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/vendure/package.json apps/vendure/
COPY packages/vendure-plugins/package.json packages/vendure-plugins/ || true
RUN pnpm install --frozen-lockfile
COPY . .
WORKDIR /workspace/apps/web
EXPOSE 4321

# “pnpm dev” provided by compose command

## QUICK START

Option A: Infra-only in Docker, apps locally

1. docker compose -f compose.infra.yml up -d
2. Open two terminals:

   * Terminal 1:
     cd apps/vendure
     pnpm install
     pnpm run migration\:run
     pnpm dev
   * Terminal 2:
     cd apps/web
     pnpm install
     pnpm dev
3. Visit:

   * Shop API:  [http://localhost:3000/shop-api](http://localhost:3000/shop-api)
   * Admin API: [http://localhost:3000/admin-api](http://localhost:3000/admin-api)
   * Storefront: [http://localhost:4321](http://localhost:4321)
   * MailHog UI: [http://localhost:8025](http://localhost:8025)

Option B: Full dev-in-docker (apps + infra)

1. docker compose -f compose.dev.yml up --build
2. Same URLs as above. Source code changes hot-reload inside containers.

Notes:
• First migration run is required because TYPEORM\_SYNCHRONIZE=false.
• If you change entities/customFields, generate & run a migration (see “Migrations” below).

## MIGRATIONS

Always keep TYPEORM\_SYNCHRONIZE=false.

Generate (locally or inside the vendure container):
cd apps/vendure
pnpm run migration\:generate -- --name add-something

Apply:
pnpm run migration\:run

Inside container:
docker compose exec vendure sh -lc "pnpm run migration\:run"

If you see schema drift errors, re-generate and re-run migrations.

## SEEDING / MINIMAL DATA

A SuperAdmin is provided by env (SUPERADMIN\_\*). To add sellers quickly:

1. Start Vendure (Admin API up).
2. Open scripts/multi-seller.v3.http in VS Code (requires “REST Client” extension).
3. Run the blocks to:

   * register two sellers (creates seller channels + default free ShippingMethod)
   * assign one product variant to each seller channel
   * add those variants to the same cart (Shop API)
   * fetch eligibleMethodsBySeller
   * setShippingPerSeller
   * transition to ArrangingPayment and verify “Platform fee (10%)” surcharges

## RUNNING THE APPS (LOCAL COMMANDS)

From repo root:
pnpm i                 # install for all workspaces

Vendure:
cd apps/vendure
pnpm dev               # start server on :3000
pnpm build             # production build (if applicable)
pnpm run migration\:generate -- --name <name>
pnpm run migration\:run

Web (Astro):
cd apps/web
pnpm dev               # start on :4321
pnpm build             # static/SSR build

## CHECKOUT — MULTI-SELLER SHIPPING (PHASE B STEP 1)

• UI page: [http://localhost:4321/checkout/shipping](http://localhost:4321/checkout/shipping)
• Component: apps/web/src/components/blocks/MultiSellerShipping.tsx
• Astro server routes proxying GraphQL:

* apps/web/src/pages/api/checkout/eligible-by-seller.json.ts
* apps/web/src/pages/api/checkout/set-shipping-per-seller.ts

Flow:

1. Add one item from Seller A and one from Seller B to the cart.
2. Go to /checkout/shipping, pick a method per seller, click “Save”.
3. Transition order to ArrangingPayment (Shop API mutation).
4. You should see Surcharges: “Platform fee (10%)” (one per seller).

## EDITOR SETUP (VS CODE RECOMMENDED)

Install these extensions:
• dbaeumer.vscode-eslint
• esbenp.prettier-vscode
• bradlc.vscode-tailwindcss
• astro-build.astro-vscode
• graphql.vscode-graphql-syntax
• graphql.vscode-graphql
• humao.rest-client
• streetsidesoftware.code-spell-checker
• dsznajder.es7-react-js-snippets
• editorconfig.editorconfig

Suggested workspace settings (.vscode/settings.json):
{
"editor.formatOnSave": true,
"editor.defaultFormatter": "esbenp.prettier-vscode",
"eslint.validate": \["javascript","typescript","typescriptreact","astro"],
"typescript.tsdk": "node\_modules/typescript/lib",
"tailwindCSS.experimental.configFile": "apps/web/tailwind.config.cjs"
}

If you prefer Visual Studio (full IDE), it’s not required for Node/TS projects; use VS Code for best DX.

## TROUBLESHOOTING

CORS errors from web → shop API:
• Ensure CORS\_ORIGIN=[http://localhost:4321](http://localhost:4321) and CORS\_CREDENTIALS=true in apps/vendure/.env.
• Restart Vendure.

GraphQL 400 “field does not exist”:
• Confirm you’re hitting correct endpoint:

* Admin mutations → /admin-api
* Shop mutations  → /shop-api

No shipping methods per seller:
• Verify each seller channel has a ShippingMethod assigned (Admin UI).
• Checker should be seller-only (or equivalent).
• The cart must contain lines from multiple seller channels.

Platform fee not appearing:
• Surcharges are added when transitioning to ArrangingPayment.
• Ensure you set shipping methods first and then transition state.

Database connection issues in Docker:
• Wait for db healthcheck (compose will show “healthy”).
• Check DB\_\* values in apps/vendure/.env match compose service (DB\_HOST=db).

Windows + Docker file sharing:
• Ensure your repo folder is shared with Docker Desktop (Settings → Resources → File sharing).

Ports already in use:
• Stop other services using :3000, :4321, :5432, :8025, :1025 OR change mappings in compose.

## DECISIONS & CONVENTIONS

• TYPEORM\_SYNCHRONIZE=false — always use migrations.
• Vendor-aware shipping: one method per seller channel; pick per seller in checkout.
• Surcharges: 10% platform fee added on transition to ArrangingPayment (one per seller).
• Astro proxies Shop API via server routes to keep cookies/tokens server-side.

## USEFUL URLS

• Storefront (Astro):       [http://localhost:4321](http://localhost:4321)
• Vendure Shop API:         [http://localhost:3000/shop-api](http://localhost:3000/shop-api)
• Vendure Admin API:        [http://localhost:3000/admin-api](http://localhost:3000/admin-api)
• MailHog (dev emails):     [http://localhost:8025](http://localhost:8025)

---
