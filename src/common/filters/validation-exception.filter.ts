import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    this.logger.error(`Validation Error: ${JSON.stringify(exceptionResponse)}`);
    this.logger.error(`Request Body: ${JSON.stringify(request.body)}`);
    this.logger.error(`Request Headers: ${JSON.stringify(request.headers)}`);

    response
      .status(status)
      .json(exceptionResponse);
  }
}
