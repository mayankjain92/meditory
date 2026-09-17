import { TABLE_NAMES } from '@meditory/shared';

export function getStatus(): string {
  return `Meditory backend initialized with tables: ${Object.values(TABLE_NAMES).join(', ')}`;
}
