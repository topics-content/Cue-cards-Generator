/**
 * Runs `worker(i)` for i in [0, n), at most `limit` at a time. A shared cursor refills a slot the
 * instant any worker finishes, rather than running in fixed batches, so one slow item can't stall
 * others behind it in the same batch.
 *
 * `worker` should catch its own errors if one item's failure shouldn't stop the pool outright —
 * this function doesn't interpret failures itself. `shouldStop` is checked before starting each
 * new item: once it returns true, no further items are started, but whatever's already running
 * keeps running and is always awaited before this resolves. That's the intended behaviour for a
 * budget stop mid-pool: don't abandon calls already approved and in flight, just stop starting new
 * ones.
 */
export async function runWithConcurrency(
  n: number,
  limit: number,
  worker: (i: number) => Promise<void>,
  shouldStop: () => boolean = () => false,
): Promise<void> {
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, n));
  const runners = Array.from({ length: workerCount }, async () => {
    while (next < n && !shouldStop()) {
      const i = next++;
      await worker(i);
    }
  });
  await Promise.all(runners);
}
