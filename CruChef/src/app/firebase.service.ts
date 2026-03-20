import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { environment } from './environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  public app: FirebaseApp | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Inicializar Firebase solo en el navegador para no romper SSR/prerender.
    if (isPlatformBrowser(this.platformId)) {
      if (getApps().length === 0) {
        this.app = initializeApp(environment.firebaseConfig);
      } else {
        this.app = getApp();
      }
    }
  }
}
