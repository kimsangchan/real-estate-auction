import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clusterPoints, type ClusterInput } from './cluster';

// 테스트용 투영: 위경도를 100배한 값을 픽셀 좌표로 취급한다(그리드 셀 경계를 예측 가능한 정수로 만들기 위함).
// 실제 화면에선 MapView가 naver map의 projection(fromCoordToOffset)을 주입한다.
const project = (lng: number, lat: number) => ({ x: lng * 100, y: lat * 100 });

function point(id: string, lng: number, lat: number): ClusterInput<string> {
  return { id, lng, lat, data: id };
}

test('같은 그리드 셀(기본 80px) 안의 점들은 하나의 클러스터로 묶인다', () => {
  const points = [point('a', 0, 0), point('b', 0.1, 0.1)]; // x,y: (0,0), (10,10) → 같은 80px 셀
  const features = clusterPoints(points, project);
  assert.equal(features.length, 1);
  const [feature] = features;
  assert.ok(feature);
  assert.equal(feature.count, 2);
  assert.equal(feature.lng, 0.05);
  assert.equal(feature.lat, 0.05);
});

test('그리드 경계를 넘는 점들은 서로 다른 클러스터로 남는다', () => {
  // x=79 → 셀 0, x=80 → 셀 1 (80px 그리드 경계)
  const points = [point('a', 0.79, 0), point('b', 0.8, 0)];
  const features = clusterPoints(points, project);
  assert.equal(features.length, 2);
  assert.deepEqual(
    features.map((f) => f.count).sort(),
    [1, 1],
  );
});

test('점이 하나면 그 점 자체가 클러스터가 된다', () => {
  const features = clusterPoints([point('a', 127, 37.5)], project);
  assert.equal(features.length, 1);
  const [feature] = features;
  assert.ok(feature);
  assert.equal(feature.count, 1);
  assert.equal(feature.lng, 127);
  assert.equal(feature.lat, 37.5);
  assert.equal(feature.items.length, 1);
});

test('빈 배열이면 빈 결과를 반환한다', () => {
  assert.deepEqual(clusterPoints([], project), []);
});
