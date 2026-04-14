import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const userId = req.user?.sub ?? "anon";
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const res = context.switchToHttp().getResponse();
          this.logger.log(`${method} ${url} → ${res.statusCode} (${ms}ms) user=${userId}`);
        },
        error: (err) => {
          const ms = Date.now() - start;
          const status = err.status ?? 500;
          this.logger.warn(`${method} ${url} → ${status} (${ms}ms) user=${userId} err=${err.message}`);
        },
      }),
    );
  }
}
