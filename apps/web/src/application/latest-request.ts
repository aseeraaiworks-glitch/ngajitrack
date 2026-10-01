// Abort is best-effort. Generation also rejects a response that already completed.
export class LatestRequest {
  private generation = 0;
  private controller: AbortController | null = null;
  cancel() {
    this.generation++;
    this.controller?.abort();
    this.controller = null;
  }
  begin() {
    this.cancel();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    return { signal: controller.signal, current: () => generation === this.generation && !controller.signal.aborted };
  }
}
