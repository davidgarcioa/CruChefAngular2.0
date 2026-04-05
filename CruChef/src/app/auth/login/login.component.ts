import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthShellComponent } from '../auth-shell/auth-shell.component';
import { AuthService } from '../auth.service';
import { RoleService } from '../role.service';

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
  readonly errorMessage = signal('');
  readonly noticeMessage = signal(
    this.route.snapshot.queryParamMap.get('notice') === 'verify-email'
      ? 'Revisa tu correo y confirma tu cuenta antes de iniciar sesion.'
      : this.route.snapshot.queryParamMap.get('notice') === 'verify-email-profile-warning'
        ? 'La cuenta se creo y el correo fue enviado, pero el perfil no se guardo en Firestore.'
        : '',
  );
  readonly warningMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

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
      const result = await this.authService.login(email, password);

      if (!result.profileSaved) {
        this.warningMessage.set(
          'Iniciaste sesion, pero Firestore rechazo la escritura del perfil. Revisa reglas o configuracion.',
        );
      }

      this.roleService.clearRole();
      await this.router.navigateByUrl('/select-role');
    } catch (error) {
      this.errorMessage.set(this.authService.getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
