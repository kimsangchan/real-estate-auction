// 사건 사진 메타 응답 DTO — auction_case_photo에서 바이트를 뺀 메타만 담는다 (물건 상세 갤러리용)
export interface AuctionCasePhotoDto {
  id: number;
  source: string;
  seq: number;
  categoryName: string | null;
  caption: string | null;
  contentType: string | null;
  byteSize: number;
}
