# Guide: Creating a New Service (Feature) with NestJS CLI

This guide shows **step-by-step how to add a new feature/service** to the backend using the NestJS CLI. The example is a **Bookings** feature (courts booking). You only follow the steps; no need to create the actual files if you are just learning.

---

## Prerequisites

- You are in the backend root: `backend/`
- The app is a **monolith** under `apps/api/` (single NestJS application).
- NestJS CLI is available: `pnpm exec nest` or `npx nest`.

---

## Step 1: Generate the resource (module + controller + service)

Use the NestJS CLI to scaffold a **resource**, which creates a module, controller, and service in one go.

```bash
cd backend
pnpm exec nest g resource bookings --no-spec
```

- **`bookings`**: name of the feature (will be kebab-case in URLs: `/bookings`).
- **`--no-spec`**: skip auto-generated spec files (we will add tests in a separate guide).

**What this creates (under `apps/api/src/`):**

- `bookings/bookings.module.ts`
- `bookings/bookings.controller.ts`
- `bookings/bookings.service.ts`
- `bookings/dto/create-booking.dto.ts`
- `bookings/dto/update-booking.dto.ts`
- `bookings/entities/booking.entity.ts` (if you chose REST and TypeORM when prompted)

**If the CLI asks:**

- "What transport layer?" → **REST API**
- "Would you like to generate CRUD entry points?" → **Yes** (optional; you can add routes manually too)

---

## Step 2: Register the module in the app

Open `apps/api/src/app.module.ts` and add your new module to `imports`:

```ts
import { BookingsModule } from "./bookings/bookings.module";

@Module({
  imports: [
    // ... existing modules (ConfigModule, TypeOrmModule, AuthModule, etc.)
    BookingsModule,
  ],
  // ...
})
export class AppModule {}
```

The app will now load the Bookings feature.

---

## Step 3: Add the entity to TypeORM (if using DB)

If your feature needs a database table:

1. **Define or adjust the entity** in `bookings/entities/booking.entity.ts` (e.g. columns, relations to `User`, `Court`).
2. **Register the entity in the root TypeORM config** in `app.module.ts`:

```ts
TypeOrmModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    // ...
    entities: [User, Role, PasswordResetToken, Booking], // add Booking
  }),
  // ...
});
```

3. **Register the repository in the feature module** in `bookings/bookings.module.ts`:

```ts
import { TypeOrmModule } from "@nestjs/typeorm";
import { Booking } from "./entities/booking.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Booking])],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
```

4. **Inject the repository** in `bookings.service.ts`:

```ts
constructor(
  @InjectRepository(Booking)
  private bookingRepo: Repository<Booking>,
) {}
```

---

## Step 4: Define DTOs (input validation)

Keep request bodies validated with **class-validator** and **class-transformer**:

- **Create DTO:** `bookings/dto/create-booking.dto.ts` (e.g. `courtId`, `userId`, `startAt`, `endAt`).
- **Update DTO:** `bookings/dto/update-booking.dto.ts` (e.g. `PartialType(CreateBookingDto)`).
- Export from `bookings/dto/index.ts` if you use barrel files.

Use decorators like `@IsString()`, `@IsUUID()`, `@IsDateString()`, `@Min()`, etc., so that the global `ValidationPipe` can validate and transform payloads.

---

## Step 5: Implement the service (business logic)

In `bookings.service.ts`:

- Keep **business logic** in the service (e.g. check availability, compute price).
- Use the **repository** for all DB access; avoid putting raw queries in the controller.
- Throw NestJS exceptions (`BadRequestException`, `NotFoundException`, etc.) for HTTP errors.

Example pattern:

```ts
async create(dto: CreateBookingDto) {
  // validation, business rules, then:
  return this.bookingRepo.save(this.bookingRepo.create(dto));
}
```

---

## Step 6: Wire the controller (HTTP layer)

In `bookings.controller.ts`:

- Use **DTOs** as body/query params.
- Use **guards** for auth where needed (e.g. `@UseGuards(JwtAuthGuard)`).
- Use **decorators** from `@app/common` (e.g. `@CurrentUser()`) to get the authenticated user.
- Keep the controller thin: parse request, call service, return response.

Example:

```ts
@Post()
@UseGuards(JwtAuthGuard)
async create(@Body() dto: CreateBookingDto, @CurrentUser() user: any) {
  return this.bookingsService.create(dto, user.id);
}
```

---

## Step 7: Use shared libs when needed

- **Guards / decorators:** `import { JwtAuthGuard, CurrentUser, Public } from "@app/common";`
- **Filters:** e.g. `HttpExceptionFilter` from `@app/common` (usually applied globally in `main.ts`).
- **Config:** inject `ConfigService` and use `config.get("key")` instead of `process.env` directly.

---

## Step 8: Optional – dependency on another module

If Bookings needs **Users** or **Auth**:

- Import the other **module** (e.g. `UsersModule`) into `BookingsModule`.
- Inject the other **service** (e.g. `UsersService`) in `BookingsService`; do not inject repositories from another module directly.

```ts
// bookings.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Booking]), UsersModule],
  // ...
})
export class BookingsModule {}
```

---

## Checklist summary

| Step | Action |
|------|--------|
| 1 | Run `pnpm exec nest g resource <name> --no-spec` |
| 2 | Add `<Name>Module` to `app.module.ts` imports |
| 3 | Add entity to TypeORM `entities` and to module `TypeOrmModule.forFeature([...])` |
| 4 | Define DTOs with class-validator and use them in the controller |
| 5 | Implement business logic in the service; use repository for DB |
| 6 | Wire routes in the controller; use guards and shared decorators |
| 7 | Use `@app/common` (and config) where applicable |
| 8 | Import other feature modules if the new feature depends on them |

---

## Alternative: generate only module, controller, or service

If you prefer to add pieces separately:

```bash
pnpm exec nest g module bookings
pnpm exec nest g controller bookings --no-spec
pnpm exec nest g service bookings --no-spec
```

Then create DTOs and entities manually under `apps/api/src/bookings/`.

---

## Reference structure (example)

After following this guide, a feature might look like:

```
apps/api/src/bookings/
├── dto/
│   ├── create-booking.dto.ts
│   ├── update-booking.dto.ts
│   └── index.ts
├── entities/
│   └── booking.entity.ts
├── bookings.controller.ts
├── bookings.service.ts
└── bookings.module.ts
```

For more on testing this feature, see **UNIT_TEST_GUIDE.md**. For overall architecture and patterns, see **DESIGN_PATTERNS.md**.
