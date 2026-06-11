import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthShellComponent } from '../auth-shell/auth-shell.component';
import { AuthService } from '../auth.service';
import { RoleService } from '../role.service';
import { formMaxLengths, normalizeEmailInput, trimmedRequired } from '../../shared/form-validators';
import { isAdminEmail } from '../../admin/admin.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AuthShellComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly roleService = inject(RoleService);

  readonly isSubmitting = signal(false);
  readonly isSendingReset = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');
  readonly noticeMessage = signal(
    this.route.snapshot.queryParamMap.get('notice') === 'verify-email'
      ? 'Revisa tu correo y confirma tu cuenta antes de iniciar sesion.'
      : this.route.snapshot.queryParamMap.get('notice') === 'verify-email-profile-warning'
        ? 'La cuenta se creo y el correo fue enviado, pero el perfil no se pudo sincronizar en el backend.'
        : '',
  );
  readonly warningMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    email: [
      '',
      [
        Validators.required,
        trimmedRequired,
        Validators.email,
        Validators.maxLength(formMaxLengths.email),
      ],
    ],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(formMaxLengths.password),
      ],
    ],
  });

  togglePasswordVisibility(): void {
    this.showPassword.update((isVisible) => !isVisible);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set('');
    this.noticeMessage.set('');
    this.warningMessage.set('');
    this.isSubmitting.set(true);

    try {
      const { email, password } = this.form.getRawValue();
      const result = await this.authService.login(normalizeEmailInput(email), password);

      if (!result.profileSaved) {
        this.warningMessage.set(
          'Iniciaste sesion, pero el perfil no se pudo sincronizar en el backend. Revisa la configuracion del servidor.',
        );
      }

      this.roleService.clearRole();
      this.roleService.setAllowedRoles(result.allowedRoles);
      await this.router.navigateByUrl(
        isAdminEmail(result.user.email)
          ? '/admin/restaurants'
          : this.roleService.getAllowedHomeRoute(),
      );
    } catch (error) {
      this.errorMessage.set(this.authService.getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async sendPasswordReset(): Promise<void> {
    const emailControl = this.form.controls.email;

    if (emailControl.invalid) {
      emailControl.markAsTouched();
      this.errorMessage.set('Escribe un correo valido para enviarte el enlace.');
      this.noticeMessage.set('');
      this.warningMessage.set('');
      return;
    }

    this.errorMessage.set('');
    this.noticeMessage.set('');
    this.warningMessage.set('');
    this.isSendingReset.set(true);

    try {
      await this.authService.sendPasswordReset(normalizeEmailInput(emailControl.value));
      this.noticeMessage.set(
        'Te enviamos un enlace para restablecer tu contrasena. Revisa tu correo.',
      );
    } catch (error) {
      this.errorMessage.set(this.authService.getErrorMessage(error));
    } finally {
      this.isSendingReset.set(false);
    }
  }
}
