from auth_helpers import login_client
from io import BytesIO
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from app.main import app

NS={'x':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def value(root,address):
    cell=root.find(f'.//x:c[@r="{address}"]',NS)
    if cell is None:return None
    return cell.findtext('x:is/x:t',default=cell.findtext('x:v',default='',namespaces=NS),namespaces=NS)


def test_export_full_workshop_with_styling_and_safe_text(tmp_path,monkeypatch):
    monkeypatch.setenv('FASONCEP_DATA_DIR',str(tmp_path))
    with TestClient(app) as client:
        login_client(client)
        today=datetime.now(ZoneInfo('Europe/Istanbul')).date().isoformat()
        ws=client.post('/api/workshops',json={'name':'Örnek Atölye','work_types':['Dikim']}).json()['id']
        other=client.post('/api/workshops',json={'name':'Başka Atölye','work_types':['Kesim']}).json()['id']
        base=f'/api/workshops/{ws}/operations'
        customer=client.post(f'{base}/customers',json={'name':'=HYPERLINK("https://example.com")','phone':'05550001234'}).json()['customers'][0]
        # More than one UI page; every row must be exported.
        for i in range(13):
            response=client.post(f'{base}/orders',json={'customer':customer['id'],'model':f'Model {i}','quantity':3,'price':'0.29','due':today,'variants':[{'color':'Mavi','size':'M','quantity':3}]})
            assert response.status_code==201
        order=response.json()['orders'][0]
        client.post(f'{base}/production',json={'order':order['id'],'quantity':3,'date':today})
        client.post(f'{base}/deliveries',json={'order':order['id'],'quantity':1,'date':today})
        client.post(f'{base}/payments',json={'customer':customer['id'],'amount':'0.20','date':today})
        result=client.get(f'/api/workshops/{ws}/export.xlsx')
        assert result.status_code==200
        assert result.headers['content-type'].startswith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        assert 'attachment' in result.headers['content-disposition']
        assert result.headers['cache-control']=='no-store'
        with ZipFile(BytesIO(result.content)) as z:
            workbook=ET.fromstring(z.read('xl/workbook.xml'))
            assert [s.get('name') for s in workbook.findall('x:sheets/x:sheet',NS)]==['Özet','Müşteriler','Siparişler','Üretim','Teslimatlar','Tahsilatlar','Cari','Renk Beden']
            summary=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
            assert value(summary,'B3')=='Örnek Atölye'
            assert float(value(summary,'C8'))==13
            assert float(value(summary,'C16'))==11.31
            assert float(value(summary,'C17'))==0.2
            assert float(value(summary,'C18'))==11.11
            customers=ET.fromstring(z.read('xl/worksheets/sheet2.xml'))
            literal=customers.find('.//x:c[@r="C7"]',NS)
            assert literal.get('t')=='inlineStr' and literal.find('x:f',NS) is None
            assert value(customers,'E7')=='05550001234'
            orders=ET.fromstring(z.read('xl/worksheets/sheet3.xml'))
            assert orders.find('x:autoFilter',NS).get('ref')=='B6:N19'
            assert value(orders,'C19')=='Model 12'
            assert float(value(orders,'J20'))==11.31
            assert orders.find('.//x:c[@r="K7"]',NS).get('t')=='n'
            assert orders.find('x:sheetViews/x:sheetView/x:pane',NS).get('ySplit')=='6'
            styles=z.read('xl/styles.xml').decode()
            assert 'Arial' in styles and '182D54' in styles and 'EFF6FF' in styles
            for name in z.namelist():
                if name.endswith('.xml'):ET.fromstring(z.read(name))
        # Data from another workshop cannot appear in this export.
        other_file=client.get(f'/api/workshops/{other}/export.xlsx')
        with ZipFile(BytesIO(other_file.content)) as z:
            other_summary=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
            assert value(other_summary,'C8')=='0'
        assert client.get('/api/workshops/999999/export.xlsx').status_code==404
