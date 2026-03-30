/**
 * When API client clears tokens due to 401/refresh failure, it calls this so AuthContext can clear session and send user to login.
 */
let onAuthFailure: (() => void) | null = null;

export function setOnAuthFailure(callback: (() => void) | null): void {
  onAuthFailure = callback;
}

export function triggerAuthFailure(): void {
  if (onAuthFailure) {
    onAuthFailure();
  }
}
