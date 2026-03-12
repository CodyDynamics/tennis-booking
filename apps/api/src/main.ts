import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "@app/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  const port = process.env.PORT || process.env.GATEWAY_PORT || 3000;
  await app.listen(port);
  console.log(`🚀 API is running on: http://localhost:${port}`);
}

bootstrap();
