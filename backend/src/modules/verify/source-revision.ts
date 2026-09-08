import { createHash } from 'node:crypto';
import type { VerifyPrescriptionPatient } from './interfaces/verify-prescriptions-response.interface';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value)
    .filter(([key]) => key !== 'SOURCE_REVISION')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export function sourceRevision(patient: VerifyPrescriptionPatient): string {
  return createHash('sha256').update(canonical(patient)).digest('hex');
}
