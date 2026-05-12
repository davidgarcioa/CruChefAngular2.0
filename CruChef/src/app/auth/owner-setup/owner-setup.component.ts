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
import {
  formMaxLengths,
  formPatterns,
  normalizeTextInput,
  trimmedRequired,
} from '../../shared/form-validators';

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
    name: [
      '',
      [
        Validators.required,
        trimmedRequired,
        Validators.minLength(2),
        Validators.maxLength(formMaxLengths.restaurantName),
      ],
    ],
    address: [
      '',
      [
        Validators.required,
        trimmedRequired,
        Validators.minLength(5),
        Validators.maxLength(formMaxLengths.address),
      ],
    ],
    city: [
      '',
      [
        Validators.required,
        trimmedRequired,
        Validators.minLength(2),
        Validators.maxLength(formMaxLengths.city),
        Validators.pattern(formPatterns.city),
      ],
    ],
    phone: [
      '',
      [
        Validators.required,
        trimmedRequired,
        Validators.minLength(7),
        Validators.maxLength(formMaxLengths.phone),
        Validators.pattern(formPatterns.digitsOnly),
      ],
    ],
    schedule: [
      '',
      [
        Validators.required,
        trimmedRequired,
        Validators.minLength(3),
        Validators.maxLength(formMaxLengths.schedule),
      ],
    ],
    rut: [
      '',
      [
        Validators.required,
        trimmedRequired,
        Validators.minLength(6),
        Validators.maxLength(formMaxLengths.rut),
        Validators.pattern(formPatterns.rut),
      ],
    ],
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
      const { name, address, city, phone, schedule, rut } =
        this.restaurantForm.getRawValue();
      await this.ownerService.createRestaurant(
        {
          name: normalizeTextInput(name),
          address: normalizeTextInput(address),
          city: normalizeTextInput(city),
          phone: phone.trim(),
          schedule: normalizeTextInput(schedule),
          rut: rut.trim(),
        } as RestaurantFormValue,
      );
      await this.router.navigateByUrl('/restaurants');
    } catch (error) {
      this.errorMessage.set(this.ownerService.getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
