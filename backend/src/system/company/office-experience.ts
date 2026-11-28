/**
 * Jenis tampilan office: 'classic' = office 3D lama (/), 'new' = Office Baru (/office-new/, docs/ai-office-product-spec.md).
 * Disimpan sebagai flag di Company.modules (kolom yang sudah ada) — tanpa perubahan schema.
 */
export const OFFICE_NEW_MODULE = 'office-new';
export type OfficeExperience = 'classic' | 'new';
export const OFFICE_EXPERIENCES: OfficeExperience[] = ['classic', 'new'];

export const experienceOf = (modules: string[] | null | undefined): OfficeExperience =>
  modules?.includes(OFFICE_NEW_MODULE) ? 'new' : 'classic';

export const withExperience = (modules: string[] | null | undefined, exp: OfficeExperience): string[] => {
  const rest = (modules ?? []).filter((m) => m !== OFFICE_NEW_MODULE);
  return exp === 'new' ? [...rest, OFFICE_NEW_MODULE] : rest;
};
