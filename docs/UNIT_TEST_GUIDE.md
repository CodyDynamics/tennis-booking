# Guide: Writing Unit Tests for a Feature

This guide explains **step-by-step how to add unit tests** for a NestJS feature (controller and service). We use the **Auth** feature in this project as the reference example.

---

## Prerequisites

- Jest is configured in `package.json` (root backend).
- Test files match `.*\\.spec\\.ts` and live next to the code (e.g. `auth.service.spec.ts` next to `auth.service.ts`).
- Run tests: `pnpm test` or `pnpm test -- --testPathPattern="auth"`.

---

## Where to put tests

- **Controller:** `apps/api/src/<feature>/<feature>.controller.spec.ts`
- **Service:** `apps/api/src/<feature>/<feature>.service.spec.ts`

Example for auth: `auth.controller.spec.ts`, `auth.service.spec.ts` inside `apps/api/src/auth/`.

---

## Part 1: Unit testing the controller

Controllers should stay thin: they parse the request and call the service. So we **mock the service** and assert that the right method is called with the right arguments.

### Step 1.1: Create the spec file

Create `<feature>.controller.spec.ts` in the same folder as the controller.

### Step 1.2: Set up the testing module

- Import `Test, TestingModule` from `@nestjs/testing`.
- Import the **controller** and the **service** (or its token).
- Use `Test.createTestingModule()` and provide a **mock service** with `useValue` and `jest.fn()` for each method.

Example:

```ts
import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    refreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
```

### Step 1.3: Add one `describe` per endpoint

For each route (e.g. `register`, `login`), add a `describe` block and test that the controller calls the service with the correct input.

Example:

```ts
describe("register", () => {
  it("should call authService.register with body", async () => {
    const dto = { email: "test@example.com", password: "password123", fullName: "Test", roleId: "role-uuid" };
    mockAuthService.register.mockResolvedValue({ user: {}, accessToken: "x", refreshToken: "y" });

    await controller.register(dto);

    expect(authService.register).toHaveBeenCalledWith(dto);
  });
});

describe("login", () => {
  it("should call authService.login with body", async () => {
    const dto = { email: "test@example.com", password: "password123" };
    mockAuthService.login.mockResolvedValue({ user: {}, accessToken: "x", refreshToken: "y" });

    await controller.login(dto);

    expect(authService.login).toHaveBeenCalledWith(dto);
  });
});
```

- Use **mockResolvedValue** for async methods so the controller call completes without throwing.
- Assert with **expect(service.method).toHaveBeenCalledWith(...)**.

### Step 1.4: Test error paths (optional)

If the controller passes through service errors, you can test that too:

```ts
it("should throw when service throws", async () => {
  mockAuthService.login.mockRejectedValue(new UnauthorizedException("Invalid credentials"));

  await expect(controller.login({ email: "x", password: "y" })).rejects.toThrow(UnauthorizedException);
});
```

---

## Part 2: Unit testing the service

Services contain business logic and use repositories, other services, and config. We **mock all dependencies** (repositories, JwtService, ConfigService, etc.) and test the service in isolation.

### Step 2.1: Create the spec file

Create `<feature>.service.spec.ts` in the same folder as the service.

### Step 2.2: Mock external dependencies

- **Repositories:** use `getRepositoryToken(Entity)` and provide an object with `find`, `findOne`, `save`, `create`, `update`, etc., as needed.
- **Other services:** provide `{ provide: SomeService, useValue: { method: jest.fn() } }`.
- **ConfigService / JwtService:** provide objects that return the values your service expects (e.g. `config.get(key)` returning a string).

Example for a service that uses TypeORM and JWT:

```ts
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { User } from "./entities/user.entity";

const mockUserRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((dto) => ({ ...dto, id: "new-id" })),
  update: jest.fn(),
};
```

### Step 2.3: Set up the testing module

```ts
const module: TestingModule = await Test.createTestingModule({
  providers: [
    AuthService,
    { provide: getRepositoryToken(User), useValue: mockUserRepo },
    { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
    { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue("token"), verify: jest.fn() } },
    { provide: ConfigService, useValue: { get: jest.fn((key) => configMap[key]) } },
    { provide: EmailService, useValue: { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) } },
  ],
}).compile();

service = module.get<AuthService>(AuthService);
```

Use **jest.clearAllMocks()** in `beforeEach` so each test starts with a clean state.

### Step 2.4: Test success cases

For each public method, test the **happy path**: mock dependencies to return valid data, call the service, then assert:

- Return value shape (e.g. `expect(result).toHaveProperty("accessToken")`).
- That the correct repository/service methods were called (`expect(repo.save).toHaveBeenCalledWith(...)`).

Example:

```ts
describe("register", () => {
  it("should register a new user and return user + tokens", async () => {
    userRepo.find.mockResolvedValue([]);
    userRepo.save.mockResolvedValue({ id: "new-id", email: "new@example.com", ... });
    userRepo.findOne.mockResolvedValue({ id: "new-id", email: "new@example.com", role: { name: "player" } });

    const result = await service.register(registerDto);

    expect(userRepo.find).toHaveBeenCalledWith({ where: { email: registerDto.email } });
    expect(result).toHaveProperty("user");
    expect(result).toHaveProperty("accessToken");
    expect(result).toHaveProperty("refreshToken");
  });
});
```

### Step 2.5: Test error / edge cases

- **Duplicate / not found:** mock repository to return existing data or null, then assert that the service throws the expected exception (`BadRequestException`, `NotFoundException`, etc.).
- **Invalid input or token:** mock to simulate invalid state and assert `rejects.toThrow(...)`.

Example:

```ts
it("should throw BadRequestException when email already exists", async () => {
  userRepo.find.mockResolvedValue([{ id: "existing", email: registerDto.email, organizationId: null }]);

  await expect(service.register(registerDto)).rejects.toThrow(BadRequestException);
  await expect(service.register(registerDto)).rejects.toThrow("User with this email already exists");
  expect(userRepo.save).not.toHaveBeenCalled();
});
```

### Step 2.6: Mock third-party libraries (e.g. bcrypt)

To avoid real hashing in tests, mock the module at the top of the file:

```ts
jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
  compare: jest.fn().mockResolvedValue(true),
}));
```

Then in tests you can override `compare` to return `false` to simulate wrong password.

---

## Part 3: Running and maintaining tests

### Run all tests

```bash
pnpm test
```

### Run only a feature’s tests

```bash
pnpm test -- --testPathPattern="auth"
```

### Run with coverage

```bash
pnpm run test:cov
```

### Naming and structure

- Use **describe** for the class and for each method (e.g. `describe("AuthService")`, `describe("register")`).
- Use **it("should ...")** for a single behavior.
- Keep tests independent: no shared mutable state; set up mocks in `beforeEach` and clear with `jest.clearAllMocks()`.

---

## Checklist summary

| Step | Controller tests | Service tests |
|------|------------------|----------------|
| 1 | Create `*.controller.spec.ts` | Create `*.service.spec.ts` |
| 2 | Mock the service with `useValue` + `jest.fn()` | Mock repos (getRepositoryToken), JwtService, ConfigService, etc. |
| 3 | In `beforeEach`, compile module and get controller + service | In `beforeEach`, compile module and get service; clear mocks |
| 4 | For each route: call controller with DTO, assert service method called with same DTO | For each method: set mock return values, call service, assert return value and calls |
| 5 | Optionally test that service errors are rethrown | Test error paths (throw, wrong data) with `rejects.toThrow()` |

---

## Reference: existing tests in this project

- **Controller:** `apps/api/src/auth/auth.controller.spec.ts` – AuthController with mocked AuthService.
- **Service:** `apps/api/src/auth/auth.service.spec.ts` – AuthService with mocked repositories, JwtService, ConfigService, EmailService, and bcrypt.

Use these as templates when adding tests for a new feature (e.g. Bookings). For design and layering conventions, see **DESIGN_PATTERNS.md**.
