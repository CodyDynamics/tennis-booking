# Swagger Guide

This document describes how to use Swagger UI to explore and try all Tennis Booking APIs.

---

## 1. What is Swagger?

Swagger (OpenAPI) provides:

- **Automatic API documentation**: list of endpoints, input (body, query, param), output (response).
- **Web UI** to call APIs directly from the browser.

The NestJS backend integrates **@nestjs/swagger**. When the API is running, Swagger UI is served at a fixed URL.

---

## 2. Opening Swagger UI

1. Start the backend (e.g. `pnpm run start:dev`).
2. Open your browser and go to:

   ```
   http://localhost:3000/api
   ```

   (If you changed `PORT` in `.env`, replace `3000` with that port.)

3. You will see the Swagger page with API groups (tags): **Auth**, **Users**, **Health**, **RSA**, **Courts**, **Coaches**, **Bookings**.

---

## 3. UI structure

- **Tags**: Each tag is an API group (Auth, Users, Bookings, …).
- **Endpoint**: Each row is a route (method + path). Click to expand.
- **Parameters**:
  - **Body**: JSON sent in the request (POST, PATCH, …).
  - **Query**: URL query parameters (`?courtId=...&date=...`).
  - **Path**: URL path variables (e.g. `:id`, `:kind`).
- **Responses**: Status codes (200, 201, 400, 401, …) and description (or schema) of the response.

---

## 4. Calling public APIs (no login)

Examples: **Health**, **RSA public-key**, **Auth (register, login, forgot-password, …)**.

- Open the endpoint (e.g. `GET /health` or `POST /auth/login`).
- Enter **Body** (if required) according to the schema or example.
- Click **Execute**.
- Check **Response body** and **Response headers** below.

---

## 5. Calling protected APIs (Bearer JWT)

Routes with a lock icon (e.g. **Users/profile**, **Courts** POST/PATCH/DELETE, **Bookings** …) require a JWT.

### Step 1: Get an access token

- Use **POST /auth/login** (or **POST /auth/register**).
- Example body:

  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

- From the response, copy the **`accessToken`** value.

### Step 2: Authorize in Swagger

- At the top of the Swagger page, click **Authorize**.
- For **JWT (http, Bearer)** enter:

  ```
  Bearer <paste_your_accessToken_here>
  ```

  (Paste only the token if the form already adds "Bearer".)

- Click **Authorize**, then **Close**.

### Step 3: Call protected APIs

- Open any locked endpoint (e.g. **GET /users/profile**).
- Click **Execute**. Swagger will send the header `Authorization: Bearer <token>` automatically.

---

## 6. Input (Body / Query / Param)

- **Body**: In the **Request body** tab, Swagger shows the schema (fields, types, required/optional). You can use **Example value** and edit as needed.
- **Query**: Input fields for each query (e.g. `courtId`, `date`, `from`, `to`). Fill values and Execute.
- **Path**: Parameters like `id`, `kind` are often pre-filled in the URL; you can edit them in the corresponding fields.

All fields have **descriptions** and (when defined) **examples** in Swagger via `@ApiProperty` / `@ApiQuery` / `@ApiParam` in the code.

---

## 7. Output (Response)

- Each endpoint has a **Responses** section with status codes (200, 201, 400, 401, 403, 404, …).
- Each code has a **description** and (when declared) **schema** of the response.
- After **Execute**, **Response body** shows the actual data returned by the server; **Response headers** show headers (e.g. `content-type`).

---

## 8. Notes

- **CORS**: If calling from another domain (e.g. frontend), CORS must be configured on the backend (already set in `main.ts`).
- **Token expiry**: If you get **401**, log in again (or use **POST /auth/refresh**) to get a new token, then **Authorize** again in Swagger.
- **Validation**: Body/query must match types and rules (email, min length, UUID, …); otherwise the API returns **400** with a detailed error message.

---

## 9. URL summary

| Environment   | Swagger UI                    |
| ------------- | ----------------------------- |
| Local (default) | http://localhost:3000/api     |
| Other port    | http://localhost:\<PORT\>/api |
