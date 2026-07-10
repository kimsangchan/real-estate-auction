// 지도 마커 클러스터링 — 화면 픽셀 그리드(기본 80px) 기반 그룹핑 순수 유틸 (WP-07 §1-5).
// naver 전역에 의존하지 않도록 좌표→픽셀 변환 함수(project)를 파라미터로 주입받아 테스트 가능하게 만든다.
export interface ClusterInput<T> {
  id: string;
  lng: number;
  lat: number;
  data: T;
}

export interface ClusterFeature<T> {
  lng: number;
  lat: number;
  count: number;
  items: ClusterInput<T>[];
}

export type Project = (lng: number, lat: number) => { x: number; y: number };

const DEFAULT_GRID_SIZE_PX = 80;

export function clusterPoints<T>(
  points: ClusterInput<T>[],
  project: Project,
  gridSizePx: number = DEFAULT_GRID_SIZE_PX,
): ClusterFeature<T>[] {
  const groups = new Map<string, ClusterInput<T>[]>();

  for (const point of points) {
    const { x, y } = project(point.lng, point.lat);
    const cellKey = `${Math.floor(x / gridSizePx)}_${Math.floor(y / gridSizePx)}`;
    const group = groups.get(cellKey);
    if (group) {
      group.push(point);
    } else {
      groups.set(cellKey, [point]);
    }
  }

  return Array.from(groups.values()).map((items) => ({
    lng: items.reduce((sum, item) => sum + item.lng, 0) / items.length,
    lat: items.reduce((sum, item) => sum + item.lat, 0) / items.length,
    count: items.length,
    items,
  }));
}
