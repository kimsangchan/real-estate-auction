# 법원경매정보 API의 xCordi/yCordi(카텍 평면좌표)를 WGS84 위경도로 변환한다.
from __future__ import annotations

from pyproj import Transformer

# 카텍(KATEC) — 법원경매정보가 xCordi/yCordi로 제공하는 평면좌표계.
# 응답의 wgs84Xcordi/wgs84Ycordi 필드는 정수로 반올림되어 정밀도가 없어(예: "127"/"37") 사용할 수 없다.
# 아래 계수는 서울 4개 주소 샘플(강남구/중구/관악구)로 역산 검증했다: docs/testing/WP-02-auction-collector.tdd.md 참고.
_KATEC_PROJ4 = (
    "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 "
    "+ellps=bessel +towgs84=-146.43,507.89,681.46 +units=m +no_defs"
)

_transformer = Transformer.from_crs(_KATEC_PROJ4, "EPSG:4326", always_xy=True)


def katec_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """카텍 좌표(x, y)를 (경도, 위도) WGS84로 변환한다."""
    lng, lat = _transformer.transform(x, y)
    return (lng, lat)
