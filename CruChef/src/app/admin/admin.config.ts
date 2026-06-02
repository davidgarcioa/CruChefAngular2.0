export const adminEmails = ['davidgarciaparada2020@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  return adminEmails.includes((email ?? '').trim().toLowerCase());
}
