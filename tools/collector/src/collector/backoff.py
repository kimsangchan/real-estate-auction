# 지수 백오프 대기시간 계산 — 수집기 재시도 정책의 순수 함수 (AGENTS.md 규칙 4, D-007 수집 예절)


def backoff_delay_ms(attempt: int, base_ms: int = 1500, max_ms: int = 60000) -> int:
    """재시도 회차(attempt, 1부터)에 대한 대기시간(ms)을 반환한다. 상한 max_ms로 캡."""
    if attempt < 1:
        raise ValueError("attempt는 1 이상이어야 합니다")
    if base_ms < 0 or max_ms < 0:
        raise ValueError("base_ms/max_ms는 음수일 수 없습니다")
    return min(base_ms * (2 ** (attempt - 1)), max_ms)
