import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

function readTextValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export const formPatterns = {
  fullName: /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s.'-]+$/,
  city: /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s.'-]+$/,
  digitsOnly: /^\d+$/,
  rut: /^[0-9A-Za-z.-]+$/,
};

export const formMaxLengths = {
  email: 120,
  password: 64,
  fullName: 80,
  documentNumber: 20,
  restaurantName: 80,
  address: 120,
  city: 60,
  phone: 15,
  schedule: 80,
  rut: 20,
  dishName: 80,
  notes: 250,
  reviewText: 250,
};

export const trimmedRequired: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = readTextValue(control.value);
  return value.trim().length > 0 ? null : { trimmedRequired: true };
};

export const strongPasswordValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = readTextValue(control.value);

  if (!value) {
    return null;
  }

  const errors = {
    minLength: value.length < 8,
    uppercase: !/[A-Z]/.test(value),
    lowercase: !/[a-z]/.test(value),
    number: !/\d/.test(value),
    symbol: !/[^A-Za-z0-9]/.test(value),
    noSpaces: /\s/.test(value),
  };

  return Object.values(errors).some(Boolean) ? { strongPassword: errors } : null;
};

export function normalizeTextInput(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}
