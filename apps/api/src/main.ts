import "./load-env";
import { NestFactory } from "@nestjs/core";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { Server as SocketIoServer } from "socket.io";
import type { Server as HttpServer } from "http";
import * as cookieParser from "cookie-parser";
import { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "@app/common";
import { SeedService } from "./database/seed.service";

/** Bind Socket.IO to the same HTTP server as Nest (required for Docker / single-port). */
class AppSocketIoAdapter extends IoAdapter {
  constructor(private readonly nestApp: INestApplication) {
    super(nestApp);
  }

  createIOServer(port: number, options?: Record<string, unknown>) {
    const httpServer = this.nestApp.getHttpServer() as HttpServer | undefined;
    if (httpServer) {
      return new SocketIoServer(httpServer, options);
    }
    return super.createIOServer(port, options);
  }
}

// cookie-parser is CommonJS; default import breaks on Render (.default is not a function)
const cookieParserMiddleware =
  (cookieParser as { default?: () => void }).default ??
  (cookieParser as unknown as () => void);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }
  app.useWebSocketAdapter(new AppSocketIoAdapter(app));
  // Force SeedService to run (it is not injected elsewhere, so would never be created)
  await app.get(SeedService);
  app.use(cookieParserMiddleware());

  // Log every request so Render/production logs show incoming traffic
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      console.log(`${req.method} ${req.url} ${status} ${duration}ms`);
    });
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  console.log("process.env.CORS_ORIGINS", process.env.CORS_ORIGINS);
  const corsOriginsExtra = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedOrigins = [
    frontendUrl,
    ...corsOriginsExtra,
    "https://tennis-booking-frontend-red.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://44.199.235.11",
  ].filter((url, i, arr) => arr.indexOf(url) === i);

  app.enableCors({
    origin: (origin, callback) => {
      const allow =
        !origin ||
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== "production" &&
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
      callback(null, allow ? origin || true : false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const config = new DocumentBuilder()
    .setTitle("Tennis Booking API")
    .setDescription("API for court booking and tennis coaching system")
    .setVersion("1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT", in: "header" },
      "JWT",
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  const port = Number.parseInt(
    String(process.env.PORT ?? process.env.GATEWAY_PORT ?? 3000),
    10,
  );
  const host = (process.env.HOST?.trim() || "0.0.0.0").trim();
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }
  await app.listen(port, host);
  const isProduction = process.env.NODE_ENV === "production";
  console.log(
    `🚀 API listening on http://${host}:${port} (map host port in Docker; try http://127.0.0.1:${port} if localhost fails)`,
  );
  if (!isProduction) {
    console.log(`📚 Swagger (this machine): http://localhost:${port}/api`);
  }
}

bootstrap().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
