// 네이버 Web Dynamic Map(JS v3)에서 이 화면이 실제로 쓰는 API만 담은 최소 타입 선언.
// @types/navermaps는 구 ncpClientId 시대 기준이라 이 프로젝트가 쓰는 신 콘솔 키(ncpKeyId) 로드 방식과
// 버전이 맞는지 검증되지 않아 배제하고, 전역 any 금지(ESLint no-explicit-any) 규칙을 지키기 위해
// 실사용 API 표면만 최소로 선언한다 (WP-07 §3-4).
declare namespace naver.maps {
  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }

  class LatLngBounds {
    getSW(): LatLng;
    getNE(): LatLng;
  }

  class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  interface MarkerIcon {
    content: string;
    anchor?: Point;
  }

  interface MapOptions {
    center: LatLng;
    zoom: number;
  }

  class Map {
    constructor(element: HTMLElement, options: MapOptions);
    getBounds(): LatLngBounds;
    getZoom(): number;
    setZoom(zoom: number, effect?: boolean): void;
    getProjection(): Projection;
    panBy(offset: Point): void;
    destroy(): void;
  }

  interface MarkerOptions {
    position: LatLng;
    map?: Map;
    icon?: MarkerIcon;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
  }

  class Projection {
    fromCoordToOffset(coord: LatLng): Point;
  }

  // addListener가 반환하는 핸들 — 내부 구조는 몰라도 removeListener에 되돌려주면 해제된다
  type MapEventListener = object;

  namespace Event {
    function addListener(
      target: Map | Marker,
      eventName: string,
      listener: (...args: unknown[]) => void,
    ): MapEventListener;
    function removeListener(listener: MapEventListener): void;
  }
}

interface Window {
  naver?: typeof naver;
  // 네이버 지도 인증 실패(미등록 서비스 URL 등) 시 SDK가 호출하는 전역 콜백 — 스크립트 로드 자체는
  // 성공(200)하고 이 콜백으로만 신호를 주기 때문에 Script의 onError로는 감지되지 않는다.
  navermap_authFailure?: () => void;
}
