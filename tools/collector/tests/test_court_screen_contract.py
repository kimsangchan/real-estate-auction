from pathlib import Path


SCREEN_XML_PATH = Path(__file__).parent / "fixtures" / "PGJ151F00.xml"


def test_screen_contract_uses_search_controller_for_detail_search():
    xml = SCREEN_XML_PATH.read_text(encoding="utf-8")

    assert 'id="sbm_selectGdsDtlSrch"' in xml
    assert 'action="/pgj//pgjsearch/searchControllerMain.on"' in xml
    assert 'id="dma_srchGdsDtlSrchInfo"' in xml
    assert 'id="dma_pageInfo"' in xml
    assert 'id="cortOfcCd"' in xml
    assert 'id="pageNo"' in xml
    assert 'id="startRowNo"' in xml
