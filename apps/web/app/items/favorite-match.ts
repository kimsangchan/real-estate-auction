// 관심 등록 여부 판정 — courtOfficeCode·caseNo·itemNo 자연키 3콤보로 목록에서 일치 항목을 찾는다
export interface FavoriteKey {
  courtOfficeCode: string;
  caseNo: string;
  itemNo: string;
}

export function isFavorited(favorites: FavoriteKey[], key: FavoriteKey): boolean {
  return favorites.some(
    (favorite) =>
      favorite.courtOfficeCode === key.courtOfficeCode &&
      favorite.caseNo === key.caseNo &&
      favorite.itemNo === key.itemNo,
  );
}
