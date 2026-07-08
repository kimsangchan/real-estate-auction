// 물건(사건) 단위 캐시 + 동시 요청 dedup — 재조회 시 발급(과금) 호출 0회, 동시 요청 시 1회만 (WP-04 요구사항 5·6)
export class RegistryRequestCache<T> {
  private readonly store = new Map<string, { value: T; cachedAt: number }>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(private readonly now: () => number = Date.now) {}

  get(key: string): T | undefined {
    return this.store.get(key)?.value;
  }

  async getOrFetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.store.get(key);
    if (cached) {
      return cached.value;
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      return pending;
    }

    const promise = fetcher()
      .then((value) => {
        this.store.set(key, { value, cachedAt: this.now() });
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }
}
