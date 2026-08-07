// auctionItems 사진·권리분석·실부담 조회 클라이언트 테스트 — 정상/404/실패 응답 처리를 검증한다
import {
  API_BASE_URL,
  fetchAffordability,
  fetchAuctionItemPhotos,
  fetchNoticeAnalysis,
  photoImageUrl,
} from './auctionItems';

function response(status: number, body: unknown = []): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

const KEY = {
  courtOfficeCode: 'B000210',
  caseNo: '2022타경101244',
  itemNo: '1',
};

describe('fetchAuctionItemPhotos', () => {
  it('물건 키를 인코딩해 /photos를 호출하고 메타 배열을 반환한다', async () => {
    const meta = [
      {
        id: 93,
        source: 'ITEM',
        seq: 1,
        categoryName: '전경도',
        caption: '건물 전경',
        contentType: 'image/jpeg',
        byteSize: 289045,
      },
    ];
    const fetchMock = jest.fn().mockResolvedValue(response(200, meta));
    globalThis.fetch = fetchMock;

    const result = await fetchAuctionItemPhotos(KEY);

    expect(result).toEqual(meta);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/auction-items/B000210/${encodeURIComponent(
        '2022타경101244',
      )}/1/photos`,
    );
  });

  it('404면 빈 배열을 반환한다', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(response(404));

    expect(await fetchAuctionItemPhotos(KEY)).toEqual([]);
  });

  it('그 외 실패 상태면 에러를 던진다', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(response(500));

    await expect(fetchAuctionItemPhotos(KEY)).rejects.toThrow(
      '물건 사진 조회 실패: 500',
    );
  });
});

describe('photoImageUrl', () => {
  it('사진 바이너리 엔드포인트 URL을 만든다', () => {
    expect(photoImageUrl(93)).toBe(`${API_BASE_URL}/auction-items/photos/93`);
  });
});

const ITEM_PATH = `B000210/${encodeURIComponent('2022타경101244')}/1`;

describe('fetchNoticeAnalysis', () => {
  it('물건 키를 인코딩해 /notice-analysis를 호출하고 분석 결과를 반환한다', async () => {
    const analysis = { tenants: [], source: 'NOTICE_ONLY' };
    const fetchMock = jest.fn().mockResolvedValue(response(200, analysis));
    globalThis.fetch = fetchMock;

    expect(await fetchNoticeAnalysis(KEY)).toEqual(analysis);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/auction-items/${ITEM_PATH}/notice-analysis`,
    );
  });

  it('404(명세서 미수집)면 null을 반환한다 — 빈 결과로 주면 "인수할 권리 없음"으로 읽힌다', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(response(404));

    expect(await fetchNoticeAnalysis(KEY)).toBeNull();
  });

  it('그 외 실패 상태면 에러를 던진다', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(response(500));

    await expect(fetchNoticeAnalysis(KEY)).rejects.toThrow(
      '명세서 권리분석 조회 실패: 500',
    );
  });
});

describe('fetchAffordability', () => {
  it('bidPrice가 없으면 쿼리 없이 호출한다', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200, {}));
    globalThis.fetch = fetchMock;

    await fetchAffordability(KEY);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/auction-items/${ITEM_PATH}/affordability`,
    );
  });

  it('bidPrice를 주면 쿼리로 붙여 CUSTOM 시나리오를 요청한다', async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(200, {}));
    globalThis.fetch = fetchMock;

    await fetchAffordability(KEY, 150_000_000);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/auction-items/${ITEM_PATH}/affordability?bidPrice=150000000`,
    );
  });

  it('404면 null을 반환한다', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(response(404));

    expect(await fetchAffordability(KEY)).toBeNull();
  });

  it('그 외 실패 상태면 에러를 던진다', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(response(500));

    await expect(fetchAffordability(KEY)).rejects.toThrow(
      '실부담 시나리오 조회 실패: 500',
    );
  });
});
