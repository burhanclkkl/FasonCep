"""Populate the styled XLSX template with an immutable workshop snapshot.

The template is authored with Artifact Tool. Export uses only the Python standard
library; customers do not need Excel, Node spreadsheet packages, or office services.
"""
from collections import defaultdict
from copy import deepcopy
from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO
from pathlib import Path
import math
import re
from urllib.parse import quote
from xml.etree import ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Depends
from .auth import current_user, assert_owner
from fastapi.responses import Response
from .database import connection
from .operations import snapshot

router = APIRouter()
NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
ET.register_namespace('x', NS)
ET.register_namespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
TEMPLATE = Path(__file__).parent / 'assets' / 'export-template.xlsx'
CURRENCY = '#,##0.00 "₺"'


def tag(name): return f'{{{NS}}}{name}'
def column(index): return chr(66 + index)
def cents(value): return round(value * 100)


@dataclass(frozen=True)
class Formula:
    expression: str
    value: int | float


def cell_value(cell, value):
    for child in list(cell): cell.remove(child)
    cell.attrib.pop('t', None)
    if isinstance(value, Formula):
        ET.SubElement(cell, tag('f')).text = value.expression
        ET.SubElement(cell, tag('v')).text = str(value.value)
    elif isinstance(value, (int, float)):
        if not math.isfinite(value): raise ValueError('Excel raporunda geçersiz sayı.')
        cell.set('t', 'n'); ET.SubElement(cell, tag('v')).text = str(value)
    elif isinstance(value, date):
        cell.set('t', 'n'); ET.SubElement(cell, tag('v')).text = str((value-date(1899,12,30)).days)
    else:
        cell.set('t', 'inlineStr')
        text = ET.SubElement(ET.SubElement(cell, tag('is')), tag('t'))
        text.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        # Export user text as literal text, never as an Excel formula.
        text.text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', str(value or ''))[:32767]


def totals(rows, numeric_columns):
    output = {}
    for index in numeric_columns:
        values = [row[index].value if isinstance(row[index], Formula) else row[index] for row in rows]
        value = sum(values)
        value = round(value, 2)
        output[index] = value
    return output


def build_reports(state, today):
    customers = {c['id']: c for c in state['customers']}
    orders = {o['id']: o for o in state['orders']}
    made, sent, billed, paid, count = (defaultdict(int) for _ in range(5))
    for m in state['production']: made[m['order']] += m['quantity']
    for m in state['deliveries']: sent[m['order']] += m['quantity']
    for o in orders.values(): billed[o['customer']] += o['quantity']*cents(o['price']); count[o['customer']] += 1
    for p in state['payments']: paid[p['customer']] += cents(p['amount'])
    cname = lambda key: customers[key]['name']
    customer_rows = [[c['id'], c['name'], c['contact'], c['phone'], c['email'], count[c['id']], billed[c['id']]/100, paid[c['id']]/100,
                      Formula(f'ROUND(H{r}-I{r},2)', (billed[c['id']]-paid[c['id']])/100)] for r,c in enumerate(customers.values(),7)]
    order_rows = []
    variant_rows = []
    for r,o in enumerate(orders.values(),7):
        status = 'Tamamlandı' if sent[o['id']] >= o['quantity'] else 'Teslime hazır' if made[o['id']] >= o['quantity'] else 'Üretimde' if made[o['id']] else 'Yeni'
        late = 'Gecikti' if o['due'] < today.isoformat() and sent[o['id']] < o['quantity'] else '—'
        order_rows.append([o['id'],o['model'],cname(o['customer']),o['quantity'],made[o['id']],sent[o['id']],Formula(f'E{r}-G{r}',o['quantity']-sent[o['id']]),o['price'],
                           Formula(f'ROUND(E{r}*I{r},2)',o['quantity']*cents(o['price'])/100),date.fromisoformat(o['due']),status,late,o.get('notes','')])
        for v in o.get('variants',[]): variant_rows.append([o['id'],o['model'],cname(o['customer']),v['color'],v['size'],v['quantity']])
    def movement_rows(kind):
        return [[m['id'],date.fromisoformat(m['date']),m['order'],orders[m['order']]['model'],cname(orders[m['order']]['customer']),m['quantity']]
                for m in sorted(state[kind], key=lambda x:x['date'])]
    payment_rows = [[p['id'],date.fromisoformat(p['date']),cname(p['customer']),p['amount']] for p in sorted(state['payments'],key=lambda x:x['date'])]
    ledger_rows = [[c['name'],billed[c['id']]/100,paid[c['id']]/100,Formula(f'ROUND(C{r}-D{r},2)',(billed[c['id']]-paid[c['id']])/100)] for r,c in enumerate(customers.values(),7)]
    summary = [
        ['Müşteri sayısı',len(customers)],['Sipariş sayısı',len(orders)],
        ['Aktif sipariş',sum(sent[o['id']]<o['quantity'] for o in orders.values())],
        ['Bugün teslim bekleyen',sum(o['due']==today.isoformat() and sent[o['id']]<o['quantity'] for o in orders.values())],
        ['Geciken sipariş',sum(o['due']<today.isoformat() and sent[o['id']]<o['quantity'] for o in orders.values())],
        ['Sipariş adedi',sum(o['quantity'] for o in orders.values())],['Üretilen adet',sum(made.values())],['Teslim edilen adet',sum(sent.values())],
        ['Kalan teslimat adedi',sum(o['quantity']-sent[o['id']] for o in orders.values())],
        ['Sipariş tutarı',sum(billed.values())/100],['Tahsil edilen',sum(paid.values())/100],['Açık alacak',(sum(billed.values())-sum(paid.values()))/100],
    ]
    return [
        (summary,[]),(customer_rows,[5,6,7,8]),(order_rows,[3,4,5,6,8]),(movement_rows('production'),[5]),
        (movement_rows('deliveries'),[5]),(payment_rows,[3]),(ledger_rows,[1,2,3]),(variant_rows,[5]),
    ]


def render_workbook(workshop, state, now=None):
    now = now or datetime.now(ZoneInfo('Europe/Istanbul'))
    reports = build_reports(state,now.date())
    target = BytesIO()
    with ZipFile(TEMPLATE) as source, ZipFile(target,'w',ZIP_DEFLATED) as dest:
        sheet_roots = [ET.fromstring(source.read(f'xl/worksheets/sheet{i}.xml')) for i in range(1,9)]
        # Reuse authored money/integer style IDs in summary value cells.
        money_styles = [sheet_roots[6].find(f'.//{tag("c")}[@r="C{r}"]').get('s') for r in (7,8)]
        int_styles = [sheet_roots[3].find(f'.//{tag("c")}[@r="G{r}"]').get('s') for r in (7,8)]
        entries = {}
        print_ranges = []
        for index, (root, (rows, sum_columns)) in enumerate(zip(sheet_roots,reports),1):
            if len(rows)>1_048_560: raise HTTPException(400,'Excel satır sınırı aşıldı.')
            data = root.find(tag('sheetData'))
            prototypes = {r: deepcopy(data.find(f'{tag("row")}[@r="{r}"]')) for r in (7,8,9)}
            style_rows = {r:[c.get('s','0') for c in prototypes[r]] for r in prototypes}
            cell_value(root.find(f'.//{tag("c")}[@r="B3"]'),workshop['name'])
            cell_value(root.find(f'.//{tag("c")}[@r="B4"]'),f'Rapor: {now:%d.%m.%Y %H:%M} · İstanbul · Tüm kayıtlar')
            for row in list(data):
                if int(row.get('r'))>=7: data.remove(row)
            for r,values in enumerate(rows,7):
                row = ET.SubElement(data,tag('row'),{'r':str(r),'ht':'30','customHeight':'1'})
                max_lines=1
                for i,value in enumerate(values):
                    style=style_rows[7 if r%2 else 8][i]
                    if index==1 and i==1: style=(money_styles if r>=16 else int_styles)[0 if r%2 else 1]
                    cell=ET.SubElement(row,tag('c'),{'r':f'{column(i)}{r}','s':style})
                    cell_value(cell,value)
                    if isinstance(value,str):
                        widths = {int(c.get('min')):float(c.get('width')) for c in root.findall(f'{tag("cols")}/{tag("col")}')}
                        width=widths.get(i+2,25)
                        max_lines=max(max_lines,sum(max(1,math.ceil(len(line)/max(1,width-3))) for line in value.split('\n')))
                row.set('ht',str(min(409,max(30,max_lines*14+8))))
            last_data = 6 + len(rows)
            last_row = last_data
            if sum_columns:
                last_row += 1
                row=ET.SubElement(data,tag('row'),{'r':str(last_row),'ht':'30','customHeight':'1'})
                for i in range(len(style_rows[9])):
                    cell=ET.SubElement(row,tag('c'),{'r':f'{column(i)}{last_row}','s':style_rows[9][i]})
                    if i==0: cell_value(cell,'Toplam')
                    elif i in sum_columns:
                        value=totals(rows,sum_columns)[i]
                        cell_value(cell,Formula(f'SUM({column(i)}7:{column(i)}{last_data})',value) if rows else 0)
                    else: cell_value(cell,'')
            elif not rows:
                row=ET.SubElement(data,tag('row'),{'r':'7','ht':'30','customHeight':'1'})
                cell=ET.SubElement(row,tag('c'),{'r':'B7','s':style_rows[7][0]});cell_value(cell,'Henüz kayıt yok.')
                last_row=7
            # Orders, totals and snapshots have explicit filters and print settings.
            last_col=column(len(style_rows[7])-1)
            if index!=1:
                auto=ET.Element(tag('autoFilter'),{'ref':f'B6:{last_col}{max(6,last_data)}'})
                data_index=list(root).index(data)
                root.insert(data_index+1,auto)
            for conditional in root.findall(tag('conditionalFormatting')):
                old=conditional.get('sqref','')
                conditional.set('sqref',f"{old.split(':')[0]}:{re.sub(r'[0-9]', '', old.split(':')[-1])}{max(7,last_data)}")
            margins=root.find(tag('pageMargins'))
            if margins is not None:
                margins.attrib.update(left='0.3',right='0.3',top='0.4',bottom='0.4',header='0.2',footer='0.2')
            page_setup=root.find(tag('pageSetup'))
            if page_setup is None: page_setup=ET.SubElement(root,tag('pageSetup'))
            page_setup.attrib.update(orientation='portrait' if index==1 else 'landscape',paperSize='8' if index==3 else '9',fitToWidth='1',fitToHeight='0')
            props=root.find(tag('sheetPr'))
            ET.SubElement(props,tag('pageSetUpPr'),{'fitToPage':'1'})
            print_ranges.append(f'$B$2:${last_col}${last_row}')
            entries[f'xl/worksheets/sheet{index}.xml']=ET.tostring(root,encoding='utf-8',xml_declaration=True)
        workbook=ET.fromstring(source.read('xl/workbook.xml'))
        names=workbook.find(tag('definedNames'))
        if names is None: names=ET.SubElement(workbook,tag('definedNames'))
        for i,(sheet,area) in enumerate(zip(workbook.find(tag('sheets')),print_ranges)):
            quoted="'"+sheet.get('name').replace("'","''")+"'"
            ET.SubElement(names,tag('definedName'),{'name':'_xlnm.Print_Area','localSheetId':str(i)}).text=f'{quoted}!{area}'
            ET.SubElement(names,tag('definedName'),{'name':'_xlnm.Print_Titles','localSheetId':str(i)}).text=f'{quoted}!$6:$6'
        entries['xl/workbook.xml']=ET.tostring(workbook,encoding='utf-8',xml_declaration=True)
        for item in source.infolist(): dest.writestr(item,entries.get(item.filename,source.read(item.filename)))
    return target.getvalue()


@router.get('/api/workshops/{workshop_id}/export.xlsx')
def export_workshop(workshop_id:int, user=Depends(current_user)):
    with connection() as db:
        db.execute('BEGIN')
        assert_owner(db,workshop_id,user['id'])
        state=snapshot(db,workshop_id)
        workshop=dict(db.execute('SELECT * FROM workshops WHERE id=?',(workshop_id,)).fetchone())
    content=render_workbook(workshop,state)
    safe=re.sub(r'[\x00-\x1f/\\:*?"<>|]','',workshop['name']).strip()[:70] or 'Atolye'
    filename=f'FasonCep-{safe}-{datetime.now(ZoneInfo("Europe/Istanbul")):%Y-%m-%d}.xlsx'
    return Response(content,media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers={
        'Content-Disposition':f"attachment; filename=FasonCep-{workshop_id}.xlsx; filename*=UTF-8''{quote(filename)}",'Cache-Control':'no-store',
    })
