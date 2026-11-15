import migration0001 from '../../../database/migrations/0001_init.sql?raw'
import migration0002 from '../../../database/migrations/0002_tracking.sql?raw'
import migration0003 from '../../../database/migrations/0003_routines.sql?raw'
import type { Migration } from './migrate'

/**
 * Ordered migration registry. Add a new numbered .sql file in
 * database/migrations/ and register it here (see docs/database-schema.md).
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'init',
    sql: migration0001
  },
  {
    version: 2,
    name: 'tracking',
    sql: migration0002
  },
  {
    version: 3,
    name: 'routines',
    sql: migration0003
  }
]
