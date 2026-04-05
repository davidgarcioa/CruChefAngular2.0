import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { FirebaseError } from 'firebase/app';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  Firestore,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

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
  private readonly platformId = inject(PLATFORM_ID);
  private authInstance: Auth | null = null;
  private firestoreInstance: Firestore | null = null;

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

  private get firestore(): Firestore {
    this.ensureBrowser();

    if (!this.firebaseService.app) {
      throw new Error('Firebase no esta inicializado.');
    }

    if (!this.firestoreInstance) {
      this.firestoreInstance = getFirestore(this.firebaseService.app);
    }

    return this.firestoreInstance;
  }

  private async saveUserProfile(
    uid: string,
    data: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await setDoc(doc(this.firestore, 'users', uid), data, { merge: true });
      return true;
    } catch (error) {
      console.error('No se pudo guardar el perfil en Firestore.', error);
      return false;
    }
  }

  async register(payload: RegisterPayload): Promise<AuthResult> {
    const credential = await createUserWithEmailAndPassword(
      this.auth,
      payload.email,
      payload.password,
    );

    await updateProfile(credential.user, { displayName: payload.fullName });

    const profileSaved = await this.saveUserProfile(credential.user.uid, {
      uid: credential.user.uid,
      fullName: payload.fullName,
      email: payload.email,
      documentNumber: payload.documentNumber,
      emailVerified: false,
      createdAt: serverTimestamp(),
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

    const profileSaved = await this.saveUserProfile(credential.user.uid, {
      uid: credential.user.uid,
      email: credential.user.email,
      fullName: credential.user.displayName ?? '',
      emailVerified: true,
      lastLoginAt: serverTimestamp(),
    });

    return { user: credential.user, profileSaved };
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  async requireVerifiedUser(): Promise<User> {
    const user = await this.getVerifiedUser();

    if (!user) {
      throw new Error('auth/user-not-found');
    }

    return user;
  }

  async setSelectedRole(role: UserRole): Promise<void> {
    const user = await this.requireVerifiedUser();

    await this.saveUserProfile(user.uid, {
      uid: user.uid,
      email: user.email,
      fullName: user.displayName ?? '',
      selectedRole: role,
      roleUpdatedAt: serverTimestamp(),
    });
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
      case 'permission-denied':
        return 'Firebase rechazo la escritura en la base de datos. Revisa las reglas de Firestore.';
      case 'failed-precondition':
        return 'Firestore aun no esta listo o requiere configuracion adicional.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Intenta de nuevo mas tarde.';
      case 'auth/network-request-failed':
        return 'No se pudo conectar con Firebase.';
      case 'auth/email-not-verified':
        return 'Tu correo no esta verificado. Te enviamos un nuevo enlace.';
      default:
        return 'Ocurrio un error al procesar la solicitud.';
    }
  }
}
