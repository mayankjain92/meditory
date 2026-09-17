import { DDB_PREFIX, FacilityWorker } from '@meditory/shared';

export function getStatus(): string {
  return `Meditory backend initialized with prefix: ${DDB_PREFIX.FACILITY}`;
}
