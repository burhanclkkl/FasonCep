from auth_helpers import login_client
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('FASONCEP_DATA_DIR', str(tmp_path))
    with TestClient(app) as client:
        login_client(client)
        yield client


def test_multi_workshop_http_flow(client):
    assert client.get('/api/workshops').json() == []
    first = client.post('/api/workshops', json={'name':'Birinci Atölye','work_types':['Dikim']})
    second = client.post('/api/workshops', json={'name':'İkinci Atölye','work_types':['Kesim']})
    assert first.status_code == second.status_code == 201
    first_id, second_id = first.json()['id'], second.json()['id']
    assert first_id != second_id
    changed = client.put(f'/api/workshops/{second_id}', json={'name':'Güncel Atölye','work_types':['Kesim','Dikim']})
    assert changed.status_code == 200
    rows = client.get('/api/workshops').json()
    assert [r['name'] for r in rows] == ['Birinci Atölye','Güncel Atölye']
    assert rows[0]['work_types'] == ['Dikim']
    assert client.put('/api/workshops/9999', json={'name':'Yok','work_types':['Dikim']}).status_code == 404
    assert client.put('/api/workshops/invalid', json={'name':'Yok','work_types':['Dikim']}).status_code == 422


@pytest.mark.parametrize('patch', [
    {'name':' '}, {'name':'a'}, {'name':'a'*121}, {'name':123},
    {'work_types':[]}, {'work_types':['Dikim','Dikim']}, {'work_types':['Yanlış']},
    {'phone':'abc'}, {'phone':'123'}, {'phone':'1'*16},
    {'email':'bozuk@'}, {'email':'a@firma'}, {'employee_band':'0'},
    {'address':'x'*351}, {'description':'x'*501}, {'id':42},
])
def test_invalid_payload_never_persists(client, patch):
    response = client.post('/api/workshops', json={'name':'Atölye','work_types':['Dikim'], **patch})
    assert response.status_code == 422, response.text
    assert client.get('/api/workshops').json() == []


def test_edit_response_fields_are_not_accepted_as_input(client):
    created = client.post('/api/workshops', json={'name':'Atölye','work_types':['Dikim']}).json()
    assert client.put(f"/api/workshops/{created['id']}", json=created).status_code == 422
    editable = {k:v for k,v in created.items() if k not in ('id','created_at','updated_at')}
    assert client.put(f"/api/workshops/{created['id']}", json=editable).status_code == 200
