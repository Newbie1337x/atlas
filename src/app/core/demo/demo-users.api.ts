import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { UsersApi } from '@core/users/users.api';
import { UserProfile } from '@core/users/user.model';
import { DEMO_USER } from './demo-data';

/**
 * In-memory stand-in for UsersApi in the public showcase build — see
 * environment.demo.ts. Swapped in via `{ provide: UsersApi, useClass:
 * DemoUsersApi }` in app.config.ts.
 */
@Injectable({ providedIn: 'root' })
export class DemoUsersApi extends UsersApi {
  override getMe(): Observable<UserProfile> {
    return of(DEMO_USER);
  }

  override unlinkIdentity(_provider: string): Observable<UserProfile> {
    return of(DEMO_USER);
  }
}
