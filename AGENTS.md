## Overview
Bulog WMS is a warehouse management system built as a PNPM + Turborepo monorepo. The backend is powered by NestJS and Prisma, while the frontend uses Next.js. Shared schemas and types are centralized in `packages/schema` to keep validation and API contracts consistent across applications.


```text
apps/
├── api/      # NestJS backend
└── web/      # Next.js frontend

packages/
├── schema/
├── config-eslint/
└── config-typescript/
```

## Stack

* Backend: NestJS, Prisma, PostgreSQL, Redis, BullMQ, CASL, MinIO
* Frontend: Next.js, Tailwind CSS, SWR, Zustand
* Monorepo: PNPM, Turborepo

## Critical Rules

### UUIDs Only

Never expose database `id` values in APIs, URLs, or frontend routes.

✅ `/documents/{uuid}`
❌ `/documents/123`

### Warehouse Isolation

Always scope database operations using:

```ts
const warehouseId = warehouseContext.getWarehouseId();
```

Never trust warehouse identifiers from client requests when authenticated context is available.

### Absolute Imports

Prefer absolute imports over deep relative imports.

✅

```ts
import { UserService } from '@/modules/user/user.service';
```

❌

```ts
import { UserService } from '../../../modules/user/user.service';
```

### Reuse Existing Components

Before creating a new component:

* Check existing components first
* Prefer extending existing components
* Avoid duplicate UI patterns
* Keep components reusable and composable

### API Route Synchronization

Whenever an API endpoint is added, modified, or removed:

* Update backend controller/service
* Update frontend `api-routes`
* Keep request and response types synchronized
* Remove unused routes on both frontend and backend

### Shared Schemas

Use schemas from `packages/schema` for validation and typing.

After schema changes:

```bash
pnpm --filter @bulog-wms/schema build
```

### Private Storage

Never expose raw MinIO/S3 object URLs.
Always generate presigned URLs:

```ts
storageService.getFilePrivateUrl(key);
```

### Authorization

Use CASL abilities and `PoliciesGuard` for protected endpoints.

## Backend Guidelines

* Keep controllers thin
* Place business logic in services
* Use shared Zod schemas for validation
* Throw proper NestJS exceptions
* Follow existing module structure and naming conventions
* Always apply warehouse scoping where required

## Frontend Guidelines

* Prefer reusable components
* Use SWR for server state
* Use Zustand for global state
* Use Tailwind CSS for styling
* Keep forms and API types aligned with shared schemas
* Use the global fetcher for all API requests
* Create dedicated hooks for every endpoint
* Avoid calling APIs directly inside pages or components

## Database Guidelines

* Modify schema through Prisma only
* Run `prisma generate` after schema changes
* Add indexes for frequently queried fields
* Never manually modify generated Prisma files

## Agent Rules

* Make small, focused changes
* Follow existing architecture and naming conventions
* Prefer reusing existing components and utilities
* Use absolute imports
* Keep frontend and backend API definitions synchronized
* Avoid unnecessary dependencies
* Never edit generated files
* Never hardcode secrets
* Do not change authentication behavior unless requested
* Do not save uploads to local disk
* Stream uploads directly to MinIO/S3

## Checklist

Before finishing:

* [ ] Shared schema updated and built
* [ ] Prisma schema updated (if required)
* [ ] Prisma client regenerated
* [ ] Warehouse filtering applied
* [ ] UUIDs used instead of IDs
* [ ] Frontend and backend routes synchronized
* [ ] Presigned URLs used for file access
* [ ] No duplicate components introduced
* [ ] Absolute imports used
* [ ] `pnpm build` passes