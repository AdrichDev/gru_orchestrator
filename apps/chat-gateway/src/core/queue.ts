import path from "node:path";

/**
 * Single-flight FIFO queue. Guarantees exactly one job runs at a time.
 *
 * Why: orchestrateTask() runs against the process CWD, and we switch CWD per
 * project with process.chdir(). chdir is global process state, so two tasks in
 * different repos must never overlap. Serializing also matches the personal
 * single-user assistant model — tasks queue instead of racing.
 */
export class SingleFlightQueue {
  private chain: Promise<unknown> = Promise.resolve();

  enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job);
    // Keep the chain alive regardless of any individual job's outcome.
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

/** Run `fn` with the process CWD temporarily switched to `projectPath`. */
export async function withCwd<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(path.resolve(projectPath));
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}
