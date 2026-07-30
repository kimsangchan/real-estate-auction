// auctionItems 사진 조회 클라이언트 테스트 — 정상/404/실패 응답 처리를 검증한다
import {
  API_BASE_URL,
  fetchAuctionItemPhotos,
  photoImageUrl,
} from './auctionItems';

function response(status: number, body: unknown = []): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

const KEY = { courtOfficeCode: 'B000210', caseNo: '2022타경101244', itemNo: '1' };

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
