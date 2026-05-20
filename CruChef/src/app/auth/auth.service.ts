import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { firstValueFrom } from 'rxjs';

import { environment } from '../environment';
import { FirebaseService } from '../firebase.service';

export interface RegisterPayload {
  fullName: string;
  email: string;
  documentNumber: string;
  password: string;
}

export interface AuthResult {
  profileSaved: boolean;
}

export type UserRole = 'owner' | 'user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly firebaseService = inject(FirebaseService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private authInstance: Auth | null = null;

  private ensureBrowser(): void {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Firebase Auth solo esta disponible en el navegador.');
    }
  }

  private get auth(): Auth {
    this.ensureBrowser();

    if (!this.firebaseService.app) {
      throw new Error('Firebase no esta inicializado.');
    }

    if (!this.authInstance) {
      this.authInstance = getAuth(this.firebaseService.app);
    }

    return this.authInstance;
  }

  async register(payload: RegisterPayload): Promise<AuthResult> {
    const credential = await createUserWithEmailAndPassword(
      this.auth,
      payload.email,
      payload.password,
    );

    await updateProfile(credential.user, { displayName: payload.fullName });

    const profileSaved = await this.syncProfile('/users/profile/register', {
      uid: credential.user.uid,
      fullName: payload.fullName,
      email: payload.email,
      documentNumber: payload.documentNumber,
      emailVerified: false,
    });

    try {
      await sendEmailVerification(credential.user);
    } finally {
      await signOut(this.auth);
    }

    return { profileSaved };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ user: User; profileSaved: boolean }> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    await credential.user.reload();

    if (!credential.user.emailVerified) {
      try {
        await sendEmailVerification(credential.user);
      } finally {
        await signOut(this.auth);
      }

      throw new Error('auth/email-not-verified');
    }

    const profileSaved = await this.syncProfile('/users/profile/login', {
      uid: credential.user.uid,
      email: credential.user.email,
      fullName: credential.user.displayName ?? '',
      emailVerified: true,
    });

    return { user: credential.user, profileSaved };
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async requireVerifiedUser(): Promise<User> {
    const user = await this.getVerifiedUser();

    if (!user) {
      throw new Error('auth/user-not-found');
    }

    return user;
  }

  async getIdToken(forceRefresh = false): Promise<string> {
    const user = await this.requireVerifiedUser();
    return user.getIdToken(forceRefresh);
  }

  async getAuthHeaders(): Promise<HttpHeaders> {
    const token = await this.getIdToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  async setSelectedRole(role: UserRole): Promise<void> {
    const user = await this.requireVerifiedUser();

    try {
      const headers = await this.getAuthHeaders();
      await firstValueFrom(
        this.http.post(
          `${environment.apiBaseUrl}/users/role`,
          {
            selectedRole: role,
            email: user.email ?? '',
            fullName: user.displayName ?? '',
          },
          { headers },
        ),
      );
    } catch (error) {
      console.error('No se pudo guardar el rol del usuario en el backend.', error);
    }
  }

  async getVerifiedUser(): Promise<User | null> {
    if (!isPlatformBrowser(this.platformId) || !this.firebaseService.app) {
      return null;
    }

    const user = await new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(this.auth, (currentUser) => {
        unsubscribe();
        resolve(currentUser);
      });
    });

    if (!user) {
      return null;
    }

    await user.reload();
    return user.emailVerified ? user : null;
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = typeof error.error?.message === 'string' ? error.error.message : '';
      const isFirebaseAdminCredentialError =
        message.includes('UNAUTHENTICATED') ||
        message.includes('invalid_grant') ||
        message.includes('Invalid JWT Signature');

      if (error.status === 0) {
        return 'No se pudo conectar con el backend. Verifica que Backend este corriendo en http://localhost:3000.';
      }

      if (error.status === 400) {
        return message || 'Los datos enviados no son validos.';
      }

      if (error.status === 401) {
        return message || 'Tu sesion ya no es valida. Inicia sesion de nuevo.';
      }

      if (error.status === 404) {
        return message || 'La ruta solicitada no existe en el backend.';
      }

      if (error.status >= 500) {
        if (isFirebaseAdminCredentialError) {
          return 'Firebase Admin no pudo autenticar el servidor. Genera una nueva llave firebase-key.json y reinicia el backend.';
        }

        return message || 'El backend no pudo procesar la solicitud.';
      }

      return message || 'Ocurrio un error al procesar la solicitud.';
    }

    const code =
      error instanceof FirebaseError
        ? error.code
        : error instanceof Error
          ? error.message
          : '';

    switch (code) {
      case 'auth/email-already-in-use':
        return 'Ese correo ya esta registrado.';
      case 'auth/invalid-email':
        return 'El correo no es valido.';
      case 'auth/weak-password':
        return 'La contrasena es muy debil.';
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Credenciales incorrectas.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Intenta de nuevo mas tarde.';
      case 'auth/network-request-failed':
        return 'No se pudo conectar con Firebase.';
      case 'auth/missing-email':
        return 'Escribe tu correo para enviarte el enlace.';
      case 'auth/email-not-verified':
        return 'Tu correo no esta verificado. Te enviamos un nuevo enlace.';
      default:
        return 'Ocurrio un error al procesar la solicitud.';
    }
  }

  private async syncProfile(
    path: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const headers = await this.getAuthHeaders();
      await firstValueFrom(
        this.http.post(`${environment.apiBaseUrl}${path}`, body, { headers }),
      );
      return true;
    } catch (error) {
      console.error('No se pudo sincronizar el perfil en el backend.', error);
      return false;
    }
  }
}
