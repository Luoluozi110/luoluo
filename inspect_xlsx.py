#!/usr/bin/env python3
# 轻量 xlsx 读取（零依赖，纯标准库解析 OOXML）
import sys, zipfile, re
import xml.etree.ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
RNS = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'

def col_to_idx(ref):
    m = re.match(r'([A-Z]+)(\d+)', ref)
    col = 0
    for ch in m.group(1):
        col = col * 26 + (ord(ch) - 64)
    return col - 1, int(m.group(2))

def strip_ts(s):
    # shared string may contain rich-text runs
    s = re.sub(r'<[^>]+>', '', s)
    return s

def load_shared_strings(z):
    try:
        data = z.read('xl/sharedStrings.xml')
    except KeyError:
        return []
    root = ET.fromstring(data)
    out = []
    for si in root.findall(f'{NS}si'):
        txt = ''.join(t.text or '' for t in si.iter(f'{NS}t'))
        out.append(txt)
    return out

def sheet_map(z):
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rid_target = {}
    for rel in rels:
        rid_target[rel.get('Id')] = rel.get('Target')
    name_target = {}
    for sh in wb.find(f'{NS}sheets'):
        name = sh.get('name')
        rid = sh.get(f'{RNS}id')
        target = rid_target.get(rid, '')
        if not target.startswith('xl/'):
            target = 'xl/' + target.lstrip('/')
        name_target[name] = target
    return name_target

def read_sheet(z, target, shared):
    root = ET.fromstring(z.read(target))
    rows = []
    for row in root.iter(f'{NS}row'):
        cells = {}
        maxc = -1
        for c in row.findall(f'{NS}c'):
            ref = c.get('r')
            if not ref:
                continue
            ci, ri = col_to_idx(ref)
            t = c.get('t')
            v = c.find(f'{NS}v')
            isv = c.find(f'{NS}is')
            val = ''
            if t == 's' and v is not None:
                val = shared[int(v.text)]
            elif t == 'inlineStr' and isv is not None:
                val = ''.join(x.text or '' for x in isv.iter(f'{NS}t'))
            elif v is not None:
                val = v.text
            cells[ci] = val
            maxc = max(maxc, ci)
        if cells:
            rowlist = [cells.get(i, '') for i in range(maxc + 1)]
            rows.append(rowlist)
    return rows

def dump(path, max_rows=200):
    print('=' * 80)
    print('FILE:', path)
    z = zipfile.ZipFile(path)
    shared = load_shared_strings(z)
    sm = sheet_map(z)
    for name, target in sm.items():
        print('\n--- SHEET:', name, '---')
        rows = read_sheet(z, target, shared)
        for i, r in enumerate(rows[:max_rows]):
            # 截断超长单元格便于阅读
            r = [ (x[:40] + '…') if len(str(x)) > 40 else str(x) for x in r ]
            print(f'R{i+1}:', ' | '.join(r))
        if len(rows) > max_rows:
            print(f'... 省略 {len(rows)-max_rows} 行 (共 {len(rows)} 行)')

if __name__ == '__main__':
    for p in sys.argv[1:]:
        dump(p)
