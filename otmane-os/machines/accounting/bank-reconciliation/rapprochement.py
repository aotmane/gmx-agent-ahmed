import json,re,unicodedata,csv,io
from itertools import combinations
inv=json.load(open('/tmp/recon.json'))['inv']; allt=json.load(open('/tmp/ledger.json'))
def num(s):
    s=str(s).replace('\xa0','').replace(' ','').replace('€','').replace(',','.').strip()
    try:return float(s)
    except:return None
def dt(s):
    m=re.match(r'(\d{2})/(\d{2})/(\d{4})',str(s)); return int(m.group(3))*10000+int(m.group(2))*100+int(m.group(1)) if m else None
def fix(s):
    s=str(s).upper(); s=re.sub(r'(F\d{2})-\s*-?\s*(\d)',r'\1-\2',s); s=re.sub(r'(AV\d{2})-\s*-?\s*(\d)',r'\1-\2',s); return s
def toks(s):
    s=fix(s); out=set(re.findall(r'F\d{2}-\d{4,6}',s)); out|=set('N'+x for x in re.findall(r'(?<!\d)(\d{8,9})(?!\d)',s)); return out
def norm(s):
    s=unicodedata.normalize('NFKD',str(s)).encode('ascii','ignore').decode().upper(); return re.sub(r'[^A-Z0-9 ]',' ',s)
STOP={'SAS','SARL','SA','SASU','FRANCE','PROVENCE','S','A','L','DE','DES','EURL','GIE','LA','LE','SCI','PRO'}
def kw(s): return {w for w in norm(s).split() if len(w)>2 and w not in STOP}
def skey(s):
    s=norm(s)
    for a,b in [('TERREAZUR','TA'),('TA PROVENCE','TA'),('OCEANE','OCEANE'),('FOODEX','FOODEX'),('PAK','PAK'),('METRO','METRO'),('ALPES DETERGENT','ALPES'),('COMPTOIRS OCEANIQ','COMPTOIRS')]:
        if a in s: return b
    return (s.split() or [''])[0]
def subset_sum(items,target,tol=0.02,maxk=8):
    n=len(items)
    for k in range(2,min(maxk,n)+1):
        for c in combinations(range(n),k):
            if abs(sum(items[i][1] for i in c)-target)<=tol*k: return [items[i][0] for i in c]
        if k>=6 and n>14: break
    return None

invs=[{'four':r[2] or '','facn':r[3].strip(),'ttc':num(r[10]),'date':dt(r[1]),'kw':kw(r[2] or ''),'toks':toks(r[3]),'payroll':'BULLETIN PAIE' in (r[2] or '').upper()} for r in inv]
debits=[t for t in allt if t['col']=='D']
for t in debits: t['kw']=kw(t['label']); t['ndate']=dt(t['date']); t['toks']=toks(t['label']+' '+t.get('detail',''))
bank_tokens={}
for t in debits:
    for tk in t['toks']: bank_tokens.setdefault(tk,[]).append(t)
cov=20260430
suppliers=[i for i in invs if i['date'] and i['date']<=cov and not i['payroll']]
payroll=[i for i in invs if i['payroll']]
status={id(i):['non trouvee','',''] for i in suppliers}
def match1(iv):
    for tk in iv['toks']:
        for t in bank_tokens.get(tk,[]):
            if t['ndate'] and iv['date']-10<=t['ndate']<=iv['date']+100: return ('n°',t)
    best=None
    for t in debits:
        if not t['ndate'] or t['ndate']<iv['date']-7 or t['ndate']>iv['date']+100: continue
        if iv['ttc'] and abs(t['amt']-iv['ttc'])<=max(0.5,iv['ttc']*0.006) and (iv['kw']&t['kw']):
            d=abs(t['ndate']-iv['date'])
            if best is None or d<best[0]: best=(d,t)
    if best: return ('montant',best[1])
    return (None,None)
for iv in suppliers:
    how,t=match1(iv)
    if how: status[id(iv)]=[f'rapprochee ({how})',t['date'],f"{t['amt']:.2f}"]
# pass3 date-constrained
rem=[i for i in suppliers if status[id(i)][0]=='non trouvee' and i['ttc']]
bk={}; 
for i in rem: bk.setdefault(skey(i['four']),[]).append(i)
db={}
for t in debits: db.setdefault(skey(t['label']),[]).append(t)
cons=set(); grouped=0
def D2I(n): # yyyymmdd -> ordinal-ish days for window compare (approx via month*31)
    return (n//10000)*372+((n//100)%100)*31+(n%100)
for key,items in bk.items():
    prl=sorted([t for t in db.get(key,[]) if id(t) not in cons and t['ndate']],key=lambda t:t['ndate'])
    av=set(range(len(items)))
    for t in prl:
        # candidate invoices: dated within [prlv-50d, prlv+2d] i.e. invoice precedes the debit
        cur=[(idx,items[idx]['ttc']) for idx in av if items[idx]['date'] and 0<=D2I(t['ndate'])-D2I(items[idx]['date'])<=50]
        if len(cur)<1: continue
        sub=subset_sum(cur,t['amt'])
        if sub:
            for idx in sub: status[id(items[idx])]=['rapprochee (groupe)',t['date'],f"groupe {t['amt']:.2f}"]; grouped+=1
            av-=set(sub); cons.add(id(t))
ok=sum(1 for i in suppliers if not status[id(i)][0].startswith('non'))
remaining=[i for i in suppliers if status[id(i)][0].startswith('non')]
late=[i for i in remaining if i['date']>=20260413]
print(f'Factures fournisseurs couvertes (≤30/04): {len(suppliers)}')
print(f'  rapprochees: {ok} ({round(100*ok/len(suppliers))}%)  | dont groupe(date-ok): {grouped}')
print(f'  non trouvees: {len(remaining)} — dont {len(late)} datees ≥13/04 (payees en mai)')
print(f'  inexpliquees hors calendaire: {len(remaining)-len(late)}')
# CSV
buf=io.StringIO(); w=csv.writer(buf)
w.writerow(['Date_facture','Fournisseur','N_facture','TTC','Statut','Date_banque','Detail_banque'])
for iv in sorted(invs,key=lambda x:x['date'] or 0):
    d=str(iv['date']); dd=f'{d[6:8]}/{d[4:6]}/{d[0:4]}' if len(d)==8 else ''
    if iv['payroll']: st=['paie (-> VIR SALAIRE)','','']
    elif iv['date'] and iv['date']>cov: st=['hors periode (mai)','','']
    else: st=status.get(id(iv),['non trouvee','',''])
    w.writerow([dd,iv['four'],iv['facn'],f"{iv['ttc']:.2f}" if iv['ttc'] else '',st[0],st[1],st[2]])
open('recon_for_sheet.csv','w').write(buf.getvalue())
# also semicolon french version for repo
buf2=io.StringIO(); w2=csv.writer(buf2,delimiter=';')
w2.writerow(['Date facture','Fournisseur','N° facture','TTC','Statut','Date banque','Détail banque'])
for row in csv.reader(io.StringIO(buf.getvalue())):
    w2.writerow([c.replace('.',',') if i==3 and c and c.replace('.','').isdigit() else c for i,c in enumerate(row)])
open('rapprochement_factures.csv','w').write(buf2.getvalue())
print('CSV regenerated.')
