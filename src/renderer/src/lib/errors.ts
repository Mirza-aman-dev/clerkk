export function errMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (!err) return fallback
  const msg = err instanceof Error ? err.message : String(err)
  // Electron prefixes IPC errors with "Error invoking remote method 'x': "
  const m = /Error invoking remote method '[^']+':\s*(.*)$/.exec(msg)
  if (m) return m[1]
  return msg || fallback
}
