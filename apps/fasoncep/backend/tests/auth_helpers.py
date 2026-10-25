from fastapi.testclient import TestClient
from app.main import app
TEST_ACCOUNT={'name':'Test Kullanıcı','email':'test@example.com','password':'TestParola123!'}

def login_client(client):
    client.headers['X-FasonCep-Request']='1'
    response=client.post('/api/auth/register',json=TEST_ACCOUNT)
    if response.status_code==409:response=client.post('/api/auth/login',json={k:TEST_ACCOUNT[k] for k in ('email','password')})
    assert response.status_code in (200,201),response.text
    return response.json()

def test_user():
    with TestClient(app) as client:return login_client(client)
test_user.__test__=False
