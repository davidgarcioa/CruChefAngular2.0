import { environment } from '../environment';

export const adminEmails = environment.adminEmails;

export function isAdminEmail(email: string | null | undefined): boolean {
  return adminEmails.includes((email ?? '').trim().toLowerCase());
}
