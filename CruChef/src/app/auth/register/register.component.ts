import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../auth.service';
import { AuthShellComponent } from '../auth-shell/auth-shell.component';
import {
  formMaxLengths,
  formPatterns,
  normalizeEmailInput,
  normalizeTextInput,
  strongPasswordValidator,
  trimmedRequired,
} from '../../shared/form-validators';

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
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthShellComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly isSubmitting = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly errorMessage = signal('');
  readonly warningMessage = signal('');

  readonly form = this.fb.nonNullable.group(
    {
      fullName: [
        '',
        [
          Validators.required,
          trimmedRequired,
          Validators.minLength(3),
          Validators.maxLength(formMaxLengths.fullName),
          Validators.pattern(formPatterns.fullName),
        ],
      ],
      email: [
        '',
        [
          Validators.required,
          trimmedRequired,
          Validators.email,
          Validators.maxLength(formMaxLengths.email),
        ],
      ],
      documentNumber: [
        '',
        [
          Validators.required,
          trimmedRequired,
          Validators.minLength(6),
          Validators.maxLength(formMaxLengths.documentNumber),
          Validators.pattern(formPatterns.digitsOnly),
        ],
      ],
      accountType: ['both', Validators.required],
      password: [
        '',
        [
          Validators.required,
          strongPasswordValidator,
          Validators.maxLength(formMaxLengths.password),
        ],
      ],
      confirmPassword: ['', [Validators.required, Validators.maxLength(formMaxLengths.password)]],
    },
    { validators: passwordMatchValidator },
  );

  togglePasswordVisibility(): void {
    this.showPassword.update((isVisible) => !isVisible);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((isVisible) => !isVisible);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.warningMessage.set('');
    this.isSubmitting.set(true);

    try {
      const { fullName, email, documentNumber, accountType, password } =
        this.form.getRawValue();
      const allowedRoles =
        accountType === 'user'
          ? (['user'] as const)
          : accountType === 'owner'
            ? (['owner'] as const)
            : (['user', 'owner'] as const);
      const result = await this.authService.register({
        fullName: normalizeTextInput(fullName),
        email: normalizeEmailInput(email),
        documentNumber: documentNumber.trim(),
        password,
        allowedRoles: [...allowedRoles],
      });

      if (!result.profileSaved) {
        this.warningMessage.set(
          'La cuenta se creo en Authentication, pero no se pudo sincronizar el perfil en el backend.',
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

  passwordRules(): Array<{ label: string; valid: boolean }> {
    const password = this.form.controls.password.value;

    return [
      { label: 'Minimo 8 caracteres', valid: password.length >= 8 },
      { label: 'Una letra mayuscula', valid: /[A-Z]/.test(password) },
      { label: 'Una letra minuscula', valid: /[a-z]/.test(password) },
      { label: 'Un numero', valid: /\d/.test(password) },
      { label: 'Un simbolo', valid: /[^A-Za-z0-9]/.test(password) },
      { label: 'Sin espacios', valid: password.length > 0 && !/\s/.test(password) },
    ];
  }
}
