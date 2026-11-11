import { UnprocessableEntityException } from '@nestjs/common';
import type { ValidationIssue } from '@sf/templates';

/** 422 with machine-readable issues so the UI can highlight fields. */
export function validationFailed(message: string, issues: ValidationIssue[], warnings: ValidationIssue[] = []) {
  return new UnprocessableEntityException({ statusCode: 422, message, issues, warnings });
}
