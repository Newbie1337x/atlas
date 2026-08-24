import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Cross-platform key-value storage.
 * - Native (iOS/Android): Capacitor Preferences → Keychain / EncryptedSharedPrefs
 * - Web: Capacitor Preferences falls back to localStorage automatically
 *
 * All methods are async because native APIs are. Never assume sync access to storage.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  async get(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  async clear(): Promise<void> {
    await Preferences.clear();
  }
}
