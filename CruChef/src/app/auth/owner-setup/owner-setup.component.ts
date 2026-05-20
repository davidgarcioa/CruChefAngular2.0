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
  readonly rutFileName = signal('');
  readonly scheduleError = signal('');
  readonly scheduleDays = signal([
    { id: 'mon', label: 'Lun', selected: true },
    { id: 'tue', label: 'Mar', selected: true },
    { id: 'wed', label: 'Mie', selected: true },
    { id: 'thu', label: 'Jue', selected: true },
    { id: 'fri', label: 'Vie', selected: true },
    { id: 'sat', label: 'Sab', selected: true },
    { id: 'sun', label: 'Dom', selected: true },
  ]);

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
        Validators.maxLength(formMaxLengths.schedule),
      ],
    ],
    openTime: ['08:00', Validators.required],
    closeTime: ['22:00', Validators.required],
    rutFileName: ['', Validators.required],
    rutFileType: ['', Validators.required],
    rutFileSize: [0, [Validators.required, Validators.min(1)]],
    rutFileData: ['', Validators.required],
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
    const schedule = this.buildSchedule();
    if (!schedule) {
      this.scheduleError.set('Selecciona al menos un dia y define hora de apertura y cierre.');
      return;
    }

    this.restaurantForm.controls.schedule.setValue(schedule);

    if (this.restaurantForm.invalid) {
      this.restaurantForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    try {
      const {
        name,
        address,
        city,
        phone,
        rutFileName,
        rutFileType,
        rutFileSize,
        rutFileData,
      } =
        this.restaurantForm.getRawValue();
      await this.ownerService.createRestaurant(
        {
          name: normalizeTextInput(name),
          address: normalizeTextInput(address),
          city: normalizeTextInput(city),
          phone: phone.trim(),
          schedule,
          rut: rutFileName,
          rutFileName,
          rutFileType,
          rutFileSize,
          rutFileData,
        } as RestaurantFormValue,
      );
      await this.router.navigateByUrl('/restaurants');
    } catch (error) {
      this.errorMessage.set(this.ownerService.getErrorMessage(error));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  toggleScheduleDay(dayId: string): void {
    this.scheduleDays.update((days) =>
      days.map((day) =>
        day.id === dayId ? { ...day, selected: !day.selected } : day,
      ),
    );
    this.scheduleError.set('');
  }

  async handleRutFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 1_500_000) {
      this.errorMessage.set('El archivo del RUT no puede superar 1.5 MB.');
      input.value = '';
      return;
    }

    const dataUrl = await this.readFileAsDataUrl(file);
    this.rutFileName.set(file.name);
    this.restaurantForm.patchValue({
      rutFileName: file.name,
      rutFileType: file.type || 'application/octet-stream',
      rutFileSize: file.size,
      rutFileData: dataUrl,
    });
    this.restaurantForm.controls.rutFileData.markAsTouched();
    this.errorMessage.set('');
  }

  private buildSchedule(): string {
    const selectedDays = this.scheduleDays().filter((day) => day.selected);
    const openTime = this.restaurantForm.controls.openTime.value;
    const closeTime = this.restaurantForm.controls.closeTime.value;

    if (selectedDays.length === 0 || !openTime || !closeTime) {
      return '';
    }

    const days =
      selectedDays.length === this.scheduleDays().length
        ? 'Lun-Dom'
        : selectedDays.map((day) => day.label).join(', ');

    return `${days} ${openTime} - ${closeTime}`;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
