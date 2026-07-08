// 지도 뷰포트 경위도 사각형 — 지도 홈(F-01)의 팬/줌 갱신 쿼리에 쓴다
export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}
