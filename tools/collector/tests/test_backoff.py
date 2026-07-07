# 백오프 계산 단위 테스트 — 정상/실패/경계값 (AGENTS.md 규칙 11)
import pytest

from collector.backoff import backoff_delay_ms


def test_정상_지수_증가():
    assert backoff_delay_ms(1) == 1500
    assert backoff_delay_ms(2) == 3000
    assert backoff_delay_ms(3) == 6000


def test_경계_상한_캡():
    assert backoff_delay_ms(10) == 60000
    assert backoff_delay_ms(6, base_ms=1500, max_ms=48000) == 48000


def test_실패_잘못된_입력():
    with pytest.raises(ValueError):
        backoff_delay_ms(0)
    with pytest.raises(ValueError):
        backoff_delay_ms(1, base_ms=-1)
