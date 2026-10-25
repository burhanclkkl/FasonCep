"""Workshop-scoped operations with transactional business validation."""
import json
from uuid import uuid4
from typing import Literal
from collections import defaultdict
from pydantic import ValidationError
from fastapi import APIRouter, HTTPException, Depends
from .auth import current_user, assert_owner
from .operation_schemas import CustomerInput, OrderInput, MovementInput, PaymentInput, MAX_SAFE_CENTS
from .database import connection

router = APIRouter()


def initialize_tables(db):
    db.execute('''CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY, workshop_id INTEGER NOT NULL REFERENCES workshops(id),
        name TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '', UNIQUE(id, workshop_id))''')
    db.execute('''CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, workshop_id INTEGER NOT NULL REFERENCES workshops(id),
        customer_id TEXT NOT NULL, model TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK(quantity > 0),
        price_cents INTEGER NOT NULL CHECK(price_cents > 0), due TEXT NOT NULL,
        UNIQUE(id, workshop_id),
        FOREIGN KEY(customer_id, workshop_id) REFERENCES customers(id, workshop_id))''')
    for table in ('production', 'deliveries'):
        db.execute(f'''CREATE TABLE IF NOT EXISTS {table} (
            id TEXT PRIMARY KEY, workshop_id INTEGER NOT NULL REFERENCES workshops(id),
            order_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), date TEXT NOT NULL,
            FOREIGN KEY(order_id, workshop_id) REFERENCES orders(id, workshop_id))''')
    db.execute('''CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY, workshop_id INTEGER NOT NULL REFERENCES workshops(id),
        customer_id TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), date TEXT NOT NULL,
        FOREIGN KEY(customer_id, workshop_id) REFERENCES customers(id, workshop_id))''')
    for table in ('customers', 'orders', 'production', 'deliveries', 'payments'):
        db.execute(f'CREATE INDEX IF NOT EXISTS idx_{table}_workshop ON {table}(workshop_id)')

    columns = {row['name'] for row in db.execute('PRAGMA table_info(orders)')}
    for name, definition in [('notes', "TEXT NOT NULL DEFAULT ''"), ('photo', 'TEXT'), ('variants_json', "TEXT NOT NULL DEFAULT '[]'")]:
        if name not in columns:
            db.execute(f'ALTER TABLE orders ADD COLUMN {name} {definition}')


def snapshot(db, workshop_id):
    if db.execute('SELECT id FROM workshops WHERE id=?', (workshop_id,)).fetchone() is None:
        raise HTTPException(status_code=404, detail='Atölye bulunamadı.')
    rows = {table: db.execute(f'SELECT * FROM {table} WHERE workshop_id=? ORDER BY rowid', (workshop_id,)).fetchall()
            for table in ('customers', 'orders', 'production', 'deliveries', 'payments')}
    return {
        'customers': [dict(id=r['id'], name=r['name'], contact=r['contact'], phone=r['phone'], email=r['email']) for r in rows['customers']],
        'orders': [dict(id=r['id'], customer=r['customer_id'], model=r['model'], quantity=r['quantity'], price=r['price_cents']/100, due=r['due'],
                        notes=r['notes'], photo=r['photo'], variants=json.loads(r['variants_json'])) for r in rows['orders']],
        'production': [dict(id=r['id'], order=r['order_id'], quantity=r['quantity'], date=r['date']) for r in rows['production']],
        'deliveries': [dict(id=r['id'], order=r['order_id'], quantity=r['quantity'], date=r['date']) for r in rows['deliveries']],
        'payments': [dict(id=r['id'], customer=r['customer_id'], amount=r['amount_cents']/100, date=r['date']) for r in rows['payments']],
    }


@router.get('/api/workshops/{workshop_id}/operations')
def get_operations(workshop_id: int, user=Depends(current_user)):
    with connection() as db:
        assert_owner(db,workshop_id,user["id"])
        return snapshot(db, workshop_id)


def conflict(message):
    raise HTTPException(status_code=409, detail=message)


def validate_state(state):
    customers = {c['id'] for c in state['customers']}
    names = [c['name'].replace('I', 'ı').replace('İ', 'i').casefold() for c in state['customers']]
    if len(names) != len(set(names)):
        conflict('Bu isimde bir müşteri zaten var.')
    orders = {o['id']: o for o in state['orders']}
    billed, paid = defaultdict(int), defaultdict(int)
    for order in orders.values():
        if order['customer'] not in customers:
            conflict('Müşteriye bağlı sipariş var veya müşteri bu atölyede bulunamadı.')
        billed[order['customer']] += order['quantity'] * round(order['price'] * 100)
    if sum(billed.values()) > MAX_SAFE_CENTS:
        conflict('Toplam sipariş tutarı desteklenen hesaplama sınırını aşıyor.')
    for payment in state['payments']:
        if payment['customer'] not in customers:
            conflict('Müşteriye bağlı tahsilat var veya müşteri bu atölyede bulunamadı.')
        paid[payment['customer']] += round(payment['amount'] * 100)
    for customer, amount in paid.items():
        if amount > billed[customer]:
            conflict(f'Tahsilatlar sipariş tutarını aşıyor. Tahsilat: {amount/100:.2f} ₺; sipariş toplamı: {billed[customer]/100:.2f} ₺. Önce tahsilatları kontrol edin.')
    for kind in ('production', 'deliveries'):
        for movement in state[kind]:
            if movement['order'] not in orders:
                conflict('Siparişe bağlı üretim/teslimat var veya sipariş bu atölyede bulunamadı.')
    for order in orders.values():
        produced = [m for m in state['production'] if m['order'] == order['id']]
        delivered = [m for m in state['deliveries'] if m['order'] == order['id']]
        if sum(m['quantity'] for m in produced) > order['quantity']:
            conflict('Toplam üretim sipariş adedini aşamaz.')
        if sum(m['quantity'] for m in delivered) > sum(m['quantity'] for m in produced):
            conflict('Teslim edilen adet üretilen adedi aşamaz. Önce teslimatları düzeltin.')
        for day in {m['date'] for m in delivered}:
            if sum(m['quantity'] for m in delivered if m['date'] <= day) > sum(m['quantity'] for m in produced if m['date'] <= day):
                conflict('Teslimat tarihinde yeterli üretim yok. Üretim ve teslimat tarihlerini kontrol edin.')


Kind = Literal['customers', 'orders', 'production', 'deliveries', 'payments']
MODELS = {'customers': CustomerInput, 'orders': OrderInput, 'production': MovementInput, 'deliveries': MovementInput, 'payments': PaymentInput}


def parse_payload(kind, payload):
    try:
        model = MODELS[kind].model_validate(payload)
    except ValidationError as exc:
        messages = []
        for error in exc.errors():
            field = '.'.join(str(x) for x in error['loc'])
            labels = {'name':'Firma adı', 'customer':'Müşteri', 'model':'Model', 'quantity':'Adet', 'price':'Birim fiyat', 'due':'Teslim tarihi', 'notes':'Notlar', 'photo':'Fotoğraf', 'variants':'Renk/beden dağılımı', 'order':'Sipariş', 'amount':'Tutar', 'date':'İşlem tarihi', 'email':'E-posta', 'phone':'Telefon'}
            message = error['msg'].removeprefix('Value error, ')
            translations = {'missing':'Bu alan zorunlu.', 'int_type':'Pozitif bir tam sayı girin.', 'greater_than':'Değer sıfırdan büyük olmalı.', 'less_than_equal':'Değer desteklenen üst sınırı aşıyor.', 'decimal_max_places':'En fazla iki ondalık hane kullanın.', 'decimal_max_digits':'Tutar desteklenen sınırı aşıyor.', 'finite_number':'Geçerli bir sayı girin.', 'string_too_short':'Alan boş veya çok kısa.', 'string_too_long':'Alan izin verilen uzunluğu aşıyor.', 'date_from_datetime_parsing':'Geçerli bir tarih girin.', 'date_parsing':'Geçerli bir tarih girin.', 'extra_forbidden':'Desteklenmeyen alan.'}
            message = translations.get(error['type'], message)
            label = labels.get(str(error['loc'][0]), field) if error['loc'] else ''
            messages.append(f'{label}: {message}' if label else message)
        raise HTTPException(status_code=422, detail='; '.join(messages))
    return model.model_dump(mode='json')


def db_values(kind, record):
    if kind == 'customers':
        return {k: record[k] for k in ('name', 'contact', 'phone', 'email')}
    if kind == 'orders':
        return dict(customer_id=record['customer'], model=record['model'], quantity=record['quantity'], price_cents=round(float(record['price'])*100),
                    due=record['due'], notes=record['notes'], photo=record['photo'], variants_json=json.dumps(record['variants'], ensure_ascii=False))
    if kind == 'payments':
        return dict(customer_id=record['customer'], amount_cents=round(float(record['amount'])*100), date=record['date'])
    return dict(order_id=record['order'], quantity=record['quantity'], date=record['date'])


def mutate(workshop_id, kind, user_id, payload=None, record_id=None, delete=False):
    record = parse_payload(kind, payload) if not delete else None
    # Serialize read/validate/write so simultaneous tabs cannot overproduce or overcollect.
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        assert_owner(db,workshop_id,user_id)
        state = snapshot(db, workshop_id)
        if record_id and not any(r['id'] == record_id for r in state[kind]):
            raise HTTPException(status_code=404, detail='Kayıt bu atölyede bulunamadı.')
        if record_id:
            # Reassigning dependent orders changes history, so require a fresh order instead.
            if kind == 'orders' and not delete:
                old = next(r for r in state[kind] if r['id'] == record_id)
                if old['customer'] != record['customer'] and any(m['order'] == record_id for m in state['production'] + state['deliveries']):
                    conflict('Hareket görmüş siparişin müşterisi değiştirilemez.')
            state[kind] = [r for r in state[kind] if r['id'] != record_id]
        new_id = record_id or str(uuid4())
        if not delete:
            normalized = {**record, 'id': new_id}
            if kind == 'orders': normalized['price'] = float(record['price'])
            if kind == 'payments': normalized['amount'] = float(record['amount'])
            state[kind].append(normalized)
        validate_state(state)
        if delete:
            db.execute(f'DELETE FROM {kind} WHERE id=? AND workshop_id=?', (record_id, workshop_id))
        else:
            values = db_values(kind, record)
            if record_id:
                assignments = ', '.join(f'{column}=?' for column in values)
                db.execute(f'UPDATE {kind} SET {assignments} WHERE id=? AND workshop_id=?', (*values.values(), record_id, workshop_id))
            else:
                columns = ', '.join(values)
                placeholders = ', '.join('?' for _ in values)
                db.execute(f'INSERT INTO {kind} (id, workshop_id, {columns}) VALUES (?, ?, {placeholders})', (new_id, workshop_id, *values.values()))
        result = snapshot(db, workshop_id)
    return result


@router.post('/api/workshops/{workshop_id}/operations/{kind}', status_code=201)
def create_operation(workshop_id: int, kind: Kind, payload: dict, user=Depends(current_user)):
    return mutate(workshop_id, kind, user["id"], payload)


@router.put('/api/workshops/{workshop_id}/operations/{kind}/{record_id}')
def update_operation(workshop_id: int, kind: Kind, record_id: str, payload: dict, user=Depends(current_user)):
    return mutate(workshop_id, kind, user["id"], payload, record_id)


@router.delete('/api/workshops/{workshop_id}/operations/{kind}/{record_id}')
def delete_operation(workshop_id: int, kind: Kind, record_id: str, user=Depends(current_user)):
    return mutate(workshop_id, kind, user["id"], record_id=record_id, delete=True)
