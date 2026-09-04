export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const err = error as Record<string, any>;
    if (err.meta?.body?.error?.reason) {
      return err.meta.body.error.reason;
    }
    if (err.body?.error?.reason) {
      return err.body.error.reason;
    }
    if (err.reason) {
      return err.reason;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'An unknown error occurred';
    }
  }
  return 'An unknown error occurred';
}