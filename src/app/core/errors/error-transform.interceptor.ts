import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { toHttpError } from './http-error';

/**
 * Transforms every HttpErrorResponse into an HttpError. Features and
 * components only ever handle HttpError — the raw response never leaks out
 * of the network layer.
 *
 * Ordered AFTER authInterceptor in app.config.ts: the auth interceptor gets
 * first shot at 401 (refresh + retry); anything that survives becomes an
 * HttpError.
 */
export const errorTransformInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) return throwError(() => toHttpError(err));
      return throwError(() => err);
    }),
  );
