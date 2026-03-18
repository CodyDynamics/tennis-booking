import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as cookieParser from "cookie-parser";
import { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "@app/common";

// cookie-parser is CommonJS; default import breaks on Render (.default is not a function)
const cookieParserMiddleware =
  (cookieParser as { default?: () => void }).default ??
  (cookieParser as unknown as () => void);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  const allowedOrigins = [
    frontendUrl,
    "https://tennis-booking-frontend-red.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
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

  const port = process.env.PORT || process.env.GATEWAY_PORT || 3000;
  await app.listen(port);
  const isProduction = process.env.NODE_ENV === "production";
  const baseUrl = isProduction ? `port ${port}` : `http://localhost:${port}`;
  console.log(`🚀 API is running on: ${baseUrl}`);
  if (!isProduction) {
    console.log(`📚 Swagger: http://localhost:${port}/api`);
  }
}

bootstrap();
