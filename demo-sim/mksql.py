import json, re
d = json.load(open('db.json'))
d['audit'] = d['audit'][:300]
d['notes'] = d['notes'][:150]
TYPE = {b['id']: b['type'] for b in d['boq']}
PN = {p['id']: p['name'].split(' — ')[0] for p in d['projects']}
for r in d['reports']:
    dark = 1 if (r.get('bright') or 100) < 45 else 0
    dd = r['date']; lab = f"{PN[r['projectId']]} · {dd[8:10]}/{dd[5:7]}/{dd[:4]}"
    r['photo'] = f"§P|{TYPE[r['boqId']]}|{lab}|{dark}"
U = {u['id']: u['name'] for u in d['users']}
for m in d['movements']:
    if m.get('signature'):
        m['signature'] = "§S|" + (U[m['toUserId']] if m['type']=='out' else U[m['userId']])
rows = []
for c, v in d.items():
    if isinstance(v, list):
        for r in v: rows.append((c, r['id'], r))
rows.append(('meta', 1, {'id':1, 'settings': d['settings'], 'customMaterials': d.get('customMaterials', {})}))
users = [r for r in rows if r[0]=='users']; rest = [r for r in rows if r[0]!='users']
rows = users + rest
def lit(o):
    s = json.dumps(o, ensure_ascii=False, separators=(',',':'))
    assert '$j$' not in s
    return f"$j${s}$j$::jsonb"
batches, cur, size = [], [], 0
for c,i,r in rows:
    v = f"('{c}',{i},{lit(r)},'demo-sim@indix')"
    if size + len(v.encode()) > 70000 and cur:
        batches.append(cur); cur, size = [], 0
    cur.append(v); size += len(v.encode())
batches.append(cur)
for n,b in enumerate(batches):
    open(f'batch{n}.sql','w').write("insert into public.indix_records(coll,id,data,updated_by) values\n" + ",\n".join(b) + "\non conflict (coll,id) do update set data=excluded.data, updated_at=now();")
print(len(batches), [len(open(f'batch{n}.sql').read()) for n in range(len(batches))], len(rows), max(i for c,i,r in rows))
