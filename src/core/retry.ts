export class RetryableError extends Error {}

export interface RetryOptions {
  attempts: number;
  delays: number[];
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { attempts, delays } = options;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const isLastAttempt = i === attempts - 1;
      if (!(err instanceof RetryableError) || isLastAttempt) {
        throw err;
      }
      const delay = delays[i] ?? delays[delays.length - 1];
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable: the loop above always returns or throws.
  throw new Error("retry: exhausted attempts without returning or throwing");
}
