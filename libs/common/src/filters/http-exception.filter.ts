import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : "Internal server error";

    // Log real error for 500 so we can debug DB/TypeORM issues
    if (
      status === HttpStatus.INTERNAL_SERVER_ERROR &&
      !(exception instanceof HttpException)
    ) {
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === "string" ? message : (message as any).message,
    });
  }
}
