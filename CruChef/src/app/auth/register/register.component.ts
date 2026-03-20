import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../auth.service';
import { AuthShellComponent } from '../auth-shell/auth-shell.component';

const passwordMatchValidator = (
  control: AbstractControl,
): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AuthShellComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly warningMessage = signal('');

  readonly form = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      documentNumber: ['', [Validators.required, Validators.minLength(6)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator },
  );

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.warningMessage.set('');
    this.isSubmitting.set(true);

    try {
      const { fullName, email, documentNumber, password } = this.form.getRawValue();
      const result = await this.authService.register({
        fullName,
        email,
        documentNumber,
        password,
      });

      if (!result.profileSaved) {
        this.warningMessage.set(
          'La cuenta se creo en Authentication, pero no se pudo guardar el perfil en Firestore.',
        );
      }

      await this.router.navigate(['/login'], {
        queryParams: {
          notice: result.profileSaved ? 'verify-email' : 'verify-email-profile-warning',
        },
      });
    } catch (error) {
      this.errorMessage.set(this.authService.getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
