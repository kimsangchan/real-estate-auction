from pathlib import Path


SCHEMA_PATH = Path(__file__).parents[1] / "migrations" / "001_auction_collector.sql"


def test_schema_separates_personal_information_and_excludes_resident_id():
    ddl = SCHEMA_PATH.read_text(encoding="utf-8").lower()

    assert "create table if not exists case_person" in ddl
    assert "owner_name" not in ddl
    assert "debtor_name" not in ddl
    assert "resident" not in ddl
    assert "주민" not in ddl
    assert "gist" in ddl
