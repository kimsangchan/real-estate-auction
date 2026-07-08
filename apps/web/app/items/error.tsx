// 물건 관련 화면 공용 에러 화면 — API 서버가 죽었을 때 등 빈 화면 대신 재시도 안내를 보여준다
'use client';

export default function ItemsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, textAlign: 'center' }}>
      <p>물건 정보를 불러오지 못했어요.</p>
      <p>잠시 후 다시 시도해주세요.</p>
      <button type="button" onClick={reset} style={{ marginTop: 16 }}>
        다시 시도
      </button>
    </main>
  );
}
