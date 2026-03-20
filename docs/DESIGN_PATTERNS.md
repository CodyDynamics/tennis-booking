# Backend Design Patterns & Conventions

This document describes the **architecture and design patterns** used in the backend so that new developers can follow the same conventions. It also suggests patterns where the project does not yet enforce one explicitly.

---

## 1. High-level architecture

The backend is a **NestJS monolithic application** (single process, single deployable). It is structured as a **modular monolith**: features are organized into **modules** (Auth, Users, Rsa, Health, Database, Email, etc.), each with clear boundaries.

- **Entry point:** `apps/api/src/main.ts` → `AppModule` → feature modules.
- **Shared code:** `libs/common` (guards, decorators, filters, DTOs, interfaces) and `libs/messaging` (if needed). Use path aliases `@app/common`, `@app/messaging`.
- **Configuration:** Centralized in `apps/api/src/config/configuration.ts`, loaded via `ConfigModule`; use `ConfigService` in services instead of `process.env` directly where possible.

---

## 2. Layered structure (recommended pattern)

We follow a **layered architecture** within each feature:

```
HTTP Request
    → Controller (HTTP layer: parse input, call service, return response)
    → Service (business logic: validation, orchestration, use cases)
    → Repository (data access: TypeORM Repository or custom repo)
    → Database / external APIs
```

- **Controller:** Thin. Only handles HTTP (body, query, params), uses DTOs and guards, delegates to the service. No business logic.
- **Service:** Contains business logic, validation rules, and orchestration. Uses repositories and other services. Throws NestJS HTTP exceptions (`BadRequestException`, `NotFoundException`, `UnauthorizedException`, etc.).
- **Repository:** Data access. In this project we use **TypeORM repositories** (injected via `@InjectRepository(Entity)`). No business logic; only CRUD and queries.

New features should respect this layering so that testing and maintenance stay simple.

---

## 3. Module-based feature organization

Each **feature** is a NestJS **module** that groups:

- **Controller(s)** – HTTP endpoints.
- **Service(s)** – Business logic.
- **DTOs** – Request/response validation and typing.
- **Entities** – TypeORM entities when the feature owns database tables.
- **Guards / Strategies** – When specific to that feature (e.g. JWT strategy in Auth).

Conventions:

- One **feature folder** per domain concept (e.g. `auth/`, `users/`, `bookings/`).
- The module **exports** services that other modules need (e.g. `AuthModule` exports `AuthService`, `UsersModule` exports `UsersService`).
- **Cross-feature use:** Import the **module** (e.g. `UsersModule`) into another module and inject the **service**; do not inject another module’s repository directly.
- **Shared utilities and guards** live in `libs/common` and are used across features.

---

## 4. Dependency injection (DI)

NestJS provides the container; use **constructor injection** everywhere:

- Controllers inject **services**.
- Services inject **repositories** (via `@InjectRepository(Entity)`), **ConfigService**, and other **services** (from the same or imported modules).
- Do not instantiate services or repos with `new` in business code; let the DI container provide them. This makes testing and swapping implementations easy.

---

## 5. DTOs and validation

- **Input:** Use **DTO classes** with `class-validator` decorators (`@IsString()`, `@IsEmail()`, `@MinLength()`, `@IsUUID()`, etc.) for body and query.
- **Global ValidationPipe** in `main.ts` (e.g. `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) so invalid requests are rejected before reaching the service.
- **Output:** Prefer returning plain objects or DTOs that don’t expose sensitive fields (e.g. omit `passwordHash`). Use `class-transformer` and `@Exclude()` if you expose entities.

---

## 6. Error handling

- Use **NestJS built-in exceptions** for HTTP errors: `BadRequestException`, `NotFoundException`, `UnauthorizedException`, `ForbiddenException`, etc.
- Use a **global exception filter** (e.g. `HttpExceptionFilter` from `@app/common`) to format error responses consistently.
- In services, **throw** these exceptions; do not return error objects from the service layer for “expected” HTTP errors. Let the filter and NestJS turn them into HTTP responses.

---

## 7. Authentication and authorization

- **JWT:** Access (and optionally refresh) tokens; validation via Passport strategy (e.g. `JwtStrategy` in Auth module).
- **Guards:** Use `JwtAuthGuard` (from `@app/common` or Auth) for routes that require a valid token. Use `@Public()` (or equivalent) for public routes (login, register, health).
- **Current user:** Use a decorator (e.g. `@CurrentUser()`) to inject the authenticated user payload into controller methods; then pass only the needed data (e.g. `user.id`) to the service.

Keep auth logic in the **Auth** feature; other features depend on it via guards and shared decorators.

---

## 8. Database and TypeORM

- **Entities** define the schema; prefer one entity file per table.
- **Repositories:** Use TypeORM’s repository pattern (`Repository<Entity>`). Register entities in `TypeOrmModule.forRootAsync({ entities: [...] })` and in the feature module with `TypeOrmModule.forFeature([Entity])`.
- **Migrations:** In production, avoid `synchronize: true`; use migrations. In development, the project may use `synchronize` for speed; document this in setup guides (e.g. LOCAL_SETUP.md).
- **Transactions:** For multi-step writes, use the data source or repository’s transaction API so that new developers know where to add transaction boundaries.

---

## 9. Configuration and environment

- **Single source of config:** `config/configuration.ts` (or similar) that reads `process.env` and exposes a typed structure. Load it with `ConfigModule.forRoot({ load: [configuration] })`.
- **Use ConfigService** in services and modules; avoid scattering `process.env` across the codebase. This improves testability and keeps env vars documented in one place.

---

## 10. Testing

- **Unit tests:** Controllers and services tested in isolation; dependencies mocked (see **UNIT_TEST_GUIDE.md**).
- **Controller:** Mock the service; assert that the correct method is called with the correct arguments.
- **Service:** Mock repositories and other services; assert return values and that dependencies are called as expected. Mock external libs (e.g. bcrypt) when needed.
- Place `*.spec.ts` next to the file under test. Run with `pnpm test` or `pnpm test -- --testPathPattern="feature-name"`.

---

## 11. Suggested patterns to adopt (optional)

If not already in place, consider:

| Pattern | Purpose |
|--------|--------|
| **Repository abstraction** | For complex queries, introduce a small repository class (e.g. `BookingRepository`) that wraps TypeORM and is injected into the service. Keeps the service free of raw query logic. |
| **Use case / application service** | For very complex flows, one “use case” class per action (e.g. `CreateBookingUseCase`) that the controller calls. Helps keep the main service from growing too large. |
| **Constants and enums** | Centralize magic strings (e.g. role names, statuses) in a `constants` or `enums` file so they are consistent and easy to change. |
| **Response DTOs** | For important endpoints, define response DTOs (or interfaces) so API contracts are explicit and frontend/types stay in sync. |

You can introduce these gradually (e.g. start with constants and response DTOs, then repository abstraction where queries get complex).

---

## 12. File and naming conventions

- **Modules:** `kebab-case.module.ts` (e.g. `bookings.module.ts`).
- **Controllers / Services:** `kebab-case.controller.ts`, `kebab-case.service.ts`.
- **DTOs:** `kebab-case.dto.ts` (e.g. `create-booking.dto.ts`); export from `dto/index.ts` if desired.
- **Entities:** `kebab-case.entity.ts` (e.g. `booking.entity.ts`).
- **Specs:** Same name + `.spec.ts` (e.g. `auth.service.spec.ts`).
- **Routes:** Prefer kebab-case and plural for resources (e.g. `/bookings`, `/users/profile`).

---

## 13. Quick reference for new developers

1. **New feature:** See **NEW_SERVICE_GUIDE.md** (NestJS CLI, module, controller, service, DTOs, entities).
2. **Tests:** See **UNIT_TEST_GUIDE.md** (controller and service unit tests, mocks).
3. **Architecture:** This file – layered design, modules, DI, DTOs, errors, auth, DB, config.
4. **Run/setup:** See **LOCAL_SETUP.md** and **DOCKER_SETUP.md**.

Following these patterns keeps the codebase consistent and makes it easier for new team members to understand and contribute.
