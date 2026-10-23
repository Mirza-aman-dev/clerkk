export const isMac =
  typeof navigator !== 'undefined' &&
  (navigator.platform?.toLowerCase().includes('mac') ||
    navigator.userAgent?.toLowerCase().includes('macintosh'))
