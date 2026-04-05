import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthShellComponent } from '../auth-shell/auth-shell.component';
import {
  OwnerService,
  RestaurantFormValue,
} from '../../dashboard/owner.service';

@Component({
  selector: 'app-owner-setup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AuthShellComponent],
  templateUrl: './owner-setup.component.html',
  styleUrl: './owner-setup.component.css',
})
export class OwnerSetupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly ownerService = inject(OwnerService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');

  readonly restaurantForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(5)]],
    city: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(7)]],
    schedule: ['', [Validators.required, Validators.minLength(3)]],
    rut: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    this.ownerService
      .getRestaurants()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (restaurants) => {
        if (restaurants.length > 0) {
          await this.router.navigateByUrl('/restaurants');
        }
      });
  }

  async submit(): Promise<void> {
    if (this.restaurantForm.invalid) {
      this.restaurantForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      await this.ownerService.createRestaurant(
        this.restaurantForm.getRawValue() as RestaurantFormValue,
      );
      await this.router.navigateByUrl('/restaurants');
    } catch (error) {
      this.errorMessage.set(this.ownerService.getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
