import { getDb, now, logActivity } from './index'
import { ActivityEntry } from '../../shared/types'

export function listActivity(limit = 12): ActivityEntry[] {
  return getDb()
    .prepare('SELECT * FROM activity_log ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(limit) as ActivityEntry[]
}
