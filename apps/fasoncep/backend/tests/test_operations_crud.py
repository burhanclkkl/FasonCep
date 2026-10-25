from auth_helpers import login_client
import base64
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest
from fastapi.testclient import TestClient
from app.main import app

TODAY = datetime.now(ZoneInfo('Europe/Istanbul')).date().isoformat()
YESTERDAY = (datetime.now(ZoneInfo('Europe/Istanbul')).date()-timedelta(days=1)).isoformat()
TOMORROW = (datetime.now(ZoneInfo('Europe/Istanbul')).date()+timedelta(days=1)).isoformat()


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv('FASONCEP_DATA_DIR', str(tmp_path))
    with TestClient(app) as client:
        login_client(client)
        ws = client.post('/api/workshops', json={'name':'Test Atölye','work_types':['Dikim']}).json()['id']
        yield client, f'/api/workshops/{ws}/operations'


def add(client, url, kind, payload):
    response = client.post(f'{url}/{kind}', json=payload)
    assert response.status_code == 201, response.text
    return response.json()[kind][-1]


def setup_order(client, url):
    customer = add(client,url,'customers',{'name':'Test Firma'})
    payload = dict(customer=customer['id'],model='Tişört',quantity=100,price='12.50',due=TODAY)
    order = add(client,url,'orders',payload)
    return customer, order, payload


def test_full_persistent_crud_and_reverse_dependencies(env):
    c,u=env
    customer,order,payload=setup_order(c,u)
    customer_url=f"{u}/customers/{customer['id']}"
    assert c.put(customer_url,json={'name':'Güncel Firma','contact':'Ece'}).status_code==200
    production=add(c,u,'production',{'order':order['id'],'quantity':80,'date':TODAY})
    production_url=f"{u}/production/{production['id']}"
    assert c.put(production_url,json={'order':order['id'],'quantity':100,'date':TODAY}).status_code==200
    delivery=add(c,u,'deliveries',{'order':order['id'],'quantity':70,'date':TODAY})
    delivery_url=f"{u}/deliveries/{delivery['id']}"
    assert c.put(delivery_url,json={'order':order['id'],'quantity':60,'date':TODAY}).status_code==200
    payment=add(c,u,'payments',{'customer':customer['id'],'amount':'500.00','date':TODAY})
    payment_url=f"{u}/payments/{payment['id']}"
    assert c.put(payment_url,json={'customer':customer['id'],'amount':'400.00','date':TODAY}).status_code==200
    # A fresh request reads the saved database state.
    state=c.get(u).json()
    assert state['customers'][0]['name']=='Güncel Firma'
    assert state['production'][0]['quantity']==100
    assert state['deliveries'][0]['quantity']==60
    assert state['payments'][0]['amount']==400
    assert c.delete(customer_url).status_code==409
    assert c.delete(f"{u}/orders/{order['id']}").status_code==409
    assert c.delete(production_url).status_code==409
    assert c.put(production_url,json={'order':order['id'],'quantity':50,'date':TODAY}).status_code==409
    assert c.delete(delivery_url).status_code==200
    assert c.delete(production_url).status_code==200
    assert c.delete(f"{u}/orders/{order['id']}").status_code==409
    assert c.delete(payment_url).status_code==200
    assert c.delete(f"{u}/orders/{order['id']}").status_code==200
    assert c.delete(customer_url).status_code==200
    assert all(not rows for rows in c.get(u).json().values())


def test_edit_order_metadata_and_invalid_reductions_rollback(env):
    c,u=env
    customer,order,payload=setup_order(c,u)
    order_url=f"{u}/orders/{order['id']}"
    updated={**payload,'notes':'Kesim yönüne dikkat','variants':[{'color':'Mavi','size':'M','quantity':60},{'color':'Mavi','size':'L','quantity':40}]}
    assert c.put(order_url,json=updated).status_code==200
    assert c.get(u).json()['orders'][0]['notes']=='Kesim yönüne dikkat'
    add(c,u,'production',{'order':order['id'],'quantity':80,'date':TODAY})
    assert c.put(order_url,json={**payload,'quantity':70}).status_code==409
    assert c.get(u).json()['orders'][0]['quantity']==100
    other=add(c,u,'customers',{'name':'Başka Firma'})
    assert c.put(order_url,json={**payload,'customer':other['id']}).status_code==409
    add(c,u,'payments',{'customer':customer['id'],'amount':'1000','date':TODAY})
    assert c.put(order_url,json={**payload,'price':'9.99'}).status_code==409


def test_date_ordering_and_exact_cent_balance(env):
    c,u=env
    customer,order,payload=setup_order(c,u)
    add(c,u,'production',{'order':order['id'],'quantity':50,'date':TODAY})
    assert c.post(f'{u}/deliveries',json={'order':order['id'],'quantity':1,'date':YESTERDAY}).status_code==409
    assert c.post(f'{u}/production',json={'order':order['id'],'quantity':51,'date':TODAY}).status_code==409
    assert c.post(f'{u}/deliveries',json={'order':order['id'],'quantity':51,'date':TODAY}).status_code==409
    assert c.put(f"{u}/orders/{order['id']}",json={**payload,'quantity':100,'price':'0.01'}).status_code==200
    add(c,u,'payments',{'customer':customer['id'],'amount':'0.10','date':TODAY})
    add(c,u,'payments',{'customer':customer['id'],'amount':'0.90','date':TODAY})
    assert c.post(f'{u}/payments',json={'customer':customer['id'],'amount':'0.01','date':TODAY}).status_code==409


def test_workshop_isolation(env):
    c,u=env
    customer,order,payload=setup_order(c,u)
    other=c.post('/api/workshops',json={'name':'Diğer Atölye','work_types':['Kesim']}).json()['id']
    v=f'/api/workshops/{other}/operations'
    assert c.get(v).json()['orders']==[]
    assert c.put(f"{v}/orders/{order['id']}",json=payload).status_code==404
    assert c.delete(f"{v}/customers/{customer['id']}").status_code==404
    assert c.post(f'{v}/orders',json=payload).status_code==409
    assert c.post(f'{v}/production',json={'order':order['id'],'quantity':1,'date':TODAY}).status_code==409
    assert c.post(f'{v}/payments',json={'customer':customer['id'],'amount':'1','date':TODAY}).status_code==409


@pytest.mark.parametrize('patch',[
    {'quantity':0},{'quantity':1.5},{'quantity':True},{'quantity':10000001},
    {'price':'1.001'},{'price':'-1'},{'price':'NaN'},{'due':'2026-02-30'},{'due':'1800-01-01'}, {'due':0}, {'due':'2026-10-25T00:00:00'},
    {'notes':'x'*3001},{'photo':'data:image/svg+xml;base64,PHN2Zz4='},
    {'photo':'data:image/png;base64,YmFk'},
    {'variants':[{'color':'Mavi','size':'M','quantity':99}]},
    {'variants':[{'color':'Mavi','size':'M','quantity':50},{'color':'mavi','size':'m','quantity':50}]},
])
def test_invalid_order_never_persists(env,patch):
    c,u=env
    customer=add(c,u,'customers',{'name':'Firma'})
    payload={'customer':customer['id'],'model':'Model','quantity':100,'price':'1.50','due':TODAY,**patch}
    assert c.post(f'{u}/orders',json=payload).status_code==422
    assert c.get(u).json()['orders']==[]


def test_future_movements_and_customer_validation(env):
    c,u=env
    customer,order,_=setup_order(c,u)
    for kind,payload in [('production',{'order':order['id'],'quantity':1}),('deliveries',{'order':order['id'],'quantity':1}),('payments',{'customer':customer['id'],'amount':'1'})]:
        assert c.post(f'{u}/{kind}',json={**payload,'date':TOMORROW}).status_code==422
    for payload in [{'name':' '},{'name':'Valid','phone':'123'},{'name':'Valid','email':'bad@'}]:
        assert c.post(f'{u}/customers',json=payload).status_code==422
    assert c.post(f'{u}/customers',json={'name':'firma'}).status_code==201
    assert c.post(f'{u}/customers',json={'name':'  FİRMA  '}).status_code==409


def test_photo_is_saved_and_can_be_removed(env):
    c,u=env
    _,order,payload=setup_order(c,u)
    photo='data:image/png;base64,'+base64.b64encode(bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082')).decode()
    order_url=f"{u}/orders/{order['id']}"
    assert c.put(order_url,json={**payload,'photo':photo}).status_code==200
    assert c.get(u).json()['orders'][0]['photo']==photo
    assert c.put(order_url,json={**payload,'photo':None}).status_code==200
    assert c.get(u).json()['orders'][0]['photo'] is None


def test_parallel_production_requests_cannot_exceed_order(env):
    from concurrent.futures import ThreadPoolExecutor
    c,u=env
    _,order,_=setup_order(c,u)
    payload={'order':order['id'],'quantity':80,'date':TODAY}
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses=list(executor.map(lambda _: c.post(f'{u}/production',json=payload),range(2)))
    assert sorted(r.status_code for r in responses)==[201,409]
    assert sum(m['quantity'] for m in c.get(u).json()['production'])==80


def test_data_survives_application_restart(env):
    c,u=env
    _,order,payload=setup_order(c,u)
    assert c.put(f"{u}/orders/{order['id']}",json={**payload,'notes':'Kalıcı not'}).status_code==200
    with TestClient(app) as restarted:
        login_client(restarted)
        assert restarted.get(u).json()['orders'][0]['notes']=='Kalıcı not'


def test_photo_size_limit_and_duplicate_turkish_customer_names(env):
    c,u=env
    _,order,payload=setup_order(c,u)
    raw=b'\x89PNG\r\n\x1a\n'+b'x'*(2*1024*1024)
    photo='data:image/png;base64,'+base64.b64encode(raw).decode()
    assert c.put(f"{u}/orders/{order['id']}",json={**payload,'photo':photo}).status_code==422
    add(c,u,'customers',{'name':'İPLİK Firma'})
    assert c.post(f'{u}/customers',json={'name':'iplik firma'}).status_code==409


def test_delivery_edit_must_remain_chronologically_possible(env):
    c,u=env
    _,order,_=setup_order(c,u)
    production=add(c,u,'production',{'order':order['id'],'quantity':100,'date':TODAY})
    delivery=add(c,u,'deliveries',{'order':order['id'],'quantity':50,'date':TODAY})
    assert c.put(f"{u}/deliveries/{delivery['id']}",json={'order':order['id'],'quantity':50,'date':YESTERDAY}).status_code==409
    assert c.get(u).json()['deliveries'][0]['date']==TODAY
