import { RegistryRequestCache } from './registry-request-cache';

describe('RegistryRequestCache', () => {
  it('같은 키를 재조회하면 캐시된 값을 반환하고 fetcher를 다시 호출하지 않는다', async () => {
    const cache = new RegistryRequestCache<string>();
    const fetcher = jest.fn().mockResolvedValue('value-1');

    const first = await cache.getOrFetch('case-1', fetcher);
    const second = await cache.getOrFetch('case-1', fetcher);

    expect(first).toBe('value-1');
    expect(second).toBe('value-1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('같은 키로 동시에 요청하면 fetcher는 한 번만 실행된다 (in-flight dedup)', async () => {
    const cache = new RegistryRequestCache<string>();
    let resolveFetch: (value: string) => void = () => {};
    const fetcher = jest.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const call1 = cache.getOrFetch('case-1', fetcher);
    const call2 = cache.getOrFetch('case-1', fetcher);
    resolveFetch('value-1');

    const [result1, result2] = await Promise.all([call1, call2]);

    expect(result1).toBe('value-1');
    expect(result2).toBe('value-1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('키가 다르면 각각 독립적으로 조회한다', async () => {
    const cache = new RegistryRequestCache<string>();
    const fetcher = jest.fn().mockImplementation((key: string) => Promise.resolve(`value-${key}`));

    await cache.getOrFetch('case-1', () => fetcher('case-1'));
    await cache.getOrFetch('case-2', () => fetcher('case-2'));

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('fetcher가 실패하면 in-flight 항목을 정리해 다음 호출에서 재시도할 수 있다', async () => {
    const cache = new RegistryRequestCache<string>();
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error('일시 오류'))
      .mockResolvedValueOnce('value-1');

    await expect(cache.getOrFetch('case-1', fetcher)).rejects.toThrow('일시 오류');
    const result = await cache.getOrFetch('case-1', fetcher);

    expect(result).toBe('value-1');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidate로 캐시를 지우면 다음 조회 시 다시 fetcher를 호출한다', async () => {
    const cache = new RegistryRequestCache<string>();
    const fetcher = jest.fn().mockResolvedValue('value-1');

    await cache.getOrFetch('case-1', fetcher);
    cache.invalidate('case-1');
    await cache.getOrFetch('case-1', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
