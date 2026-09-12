/**
 * Micro-vibración de confirmación (Android; iOS la ignora).
 * Touch-feedback inmediato según guía de touch psychology.
 */
export function tap(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no soportado: sin efecto */
  }
}
