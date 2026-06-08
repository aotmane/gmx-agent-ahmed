#!/usr/bin/env python3
"""
Parseur unifié de relevés bancaires MAKI ONE → ledger propre harmonisé.

Gère les DEUX banques avec un schéma de sortie commun :
  - Crédit Mutuel  (C/C EUROCOMPTE PRO, BIC CMCIFR2A)   — séparateur milliers « . »
  - BNP Paribas    (compte courant, BIC BNPAFRPPXXX)    — séparateur milliers « espace »

Pourquoi ce script existe : l'import historique du Sheet « SUIVI DES DÉPENSES »
corrompait les données (montant collé dans la date, date d'opération fausse, solde
à la place du montant). Ici on repart des PDF source.

Principe commun aux deux banques :
  1. Décompression des flux PDF (FlateDecode) via zlib — aucune dépendance externe.
  2. Extraction du texte AVEC ses coordonnées (opérateurs Tm/Td/TD + Tj/TJ).
  3. Le signe Débit/Crédit vient de la COLONNE (position X) du montant : x < 480 → Débit.
  4. Déduplication (le PDF rend chaque glyphe deux fois).
  5. Auto-validation : la somme Débit/Crédit reconstruite est comparée au total imprimé
     du relevé (« Total des mouvements » pour CM, « TOTAL DES OPERATIONS » pour BNP).
     Chaque relevé doit correspondre au centime, sinon le script le signale.

Différences gérées automatiquement :
  - détection de la banque via le BIC / l'entête ;
  - format de date : CM = JJ/MM/AAAA, BNP = JJ.MM.AA ;
  - séparateur de milliers : CM « . » (token unique) ; BNP « espace » (le montant est
    relu sur le texte APRÈS la date de valeur pour éviter de coller l'année au montant).

Usage :
    python3 parse_releve.py relevé1.pdf [relevé2.pdf ...] > ledger_unifie.csv
Sortie CSV : Date(ISO) ; Banque ; Compte ; Sens ; Montant ; Libelle ; Detail ; Source
"""
import sys, re, zlib, csv, base64, json
from collections import defaultdict

PAT = re.compile(
    rb'\[(?:[^\]\\]|\\.)*\]\s*TJ|\((?:[^()\\]|\\.)*\)\s*Tj'
    rb'|(?:-?\d*\.?\d+\s+){5}-?\d*\.?\d+\s+Tm'
    rb'|-?\d*\.?\d+\s+-?\d*\.?\d+\s+(?:Td|TD)|BT')
AMT_CELL = re.compile(r'^\d{1,3}(?:[.\xa0 ]\d{3})*,\d{2}$')   # CM amount = single token
DEC_CELL = re.compile(r'^\d{1,3},\d{2}$')                      # decimal-bearing cell (its x = column)
AMT_TEXT = re.compile(r'\d{1,3}(?:[ \xa0]\d{3})*,\d{2}')       # BNP amount inside joined text
COLUMN_X_SPLIT = 480
CM_SKIP = ('Information', 'Sous réserve', 'CAISSE', 'RELEVE', 'C/C EURO', 'Date Date',
           '(GE)', 'Page', 'CCM', 'QXBAN', 'Vous disposez', 'MAKI ONE 29')


def _unescape(b):
    return b.replace(b'\\(', b'(').replace(b'\\)', b')').replace(b'\\\\', b'\\')


def _val(s):
    s = s.replace(' ', '').replace('\xa0', '')
    return float(s.replace('.', '').replace(',', '.'))


def _rows(raw):
    """Return [(row_text, [(x, cell_text), ...]), ...] in reading order, deduped."""
    streams = []
    for s in re.findall(rb'stream\r?\n(.*?)\r?\nendstream', raw, re.DOTALL):
        try:
            streams.append(zlib.decompress(s))
        except Exception:
            pass
    out = []
    for cs in streams:
        seen = set()
        rows = defaultdict(list)
        x = y = lx = ly = 0.0
        for m in PAT.finditer(cs):
            g = m.group(0)
            if g == b'BT':
                x = y = lx = ly = 0.0
            elif g.endswith(b'Tm'):
                n = re.findall(rb'-?\d*\.?\d+', g)
                x = lx = float(n[4]); y = ly = float(n[5])
            elif g.endswith((b'Td', b'TD')):
                n = re.findall(rb'-?\d*\.?\d+', g[:-2])
                lx += float(n[0]); ly += float(n[1]); x = lx; y = ly
            else:
                if g.endswith(b'Tj'):
                    s = _unescape(re.search(rb'\((?:[^()\\]|\\.)*\)', g).group(0)[1:-1])
                else:
                    s = _unescape(b''.join(p[1:-1] for p in re.findall(rb'\((?:[^()\\]|\\.)*\)', g)))
                s = s.decode('latin-1')
                key = (round(y), round(x), s)
                if key in seen:
                    continue
                seen.add(key)
                rows[round(y)].append((x, s))
        for yy in sorted(rows, reverse=True):
            cells = sorted(rows[yy])
            out.append((' '.join(c[1] for c in cells).strip(), cells))
    return out


def parse(raw, source=''):
    rows = _rows(raw)
    full = ' '.join(t for t, _ in rows)
    bnp = 'BNPAFRPP' in full or 'RELEVE DE VOTRE COMPTE COURANT' in full
    cm = 'CMCIFR2A' in full or 'EUROCOMPTE PRO' in full
    ib = re.search(r'IBAN ?: ?([A-Z]{2}\d{2}[ \d]{20,30})', full)
    iban = re.sub(r'\s', '', ib.group(1)) if ib else '?'
    txns = []
    printed = (None, None)

    if bnp and not cm:
        bank, acct = 'BNP', (iban[-9:-2] if iban != '?' else '?')
        for text, cells in rows:
            m = re.match(r'^(\d{2}\.\d{2}\.\d{2})\s+(.*?)\s+(\d{2}\.\d{2}\.\d{2})\s+(.*)$', text)
            if m:
                am = AMT_TEXT.findall(m.group(4))   # amount AFTER the value date
                if am:
                    dec = [(cx, cs) for cx, cs in cells if DEC_CELL.match(cs.strip()) and 400 < cx < 520]
                    cx = dec[-1][0] if dec else max((c[0] for c in cells), default=500)
                    d = m.group(1)
                    txns.append({'date': f'20{d[6:8]}-{d[3:5]}-{d[0:2]}',
                                 'sens': 'D' if cx < COLUMN_X_SPLIT else 'C', 'amt': _val(am[0]),
                                 'label': m.group(2).strip(), 'detail': '', 'bank': bank, 'acct': acct})
            if 'TOTAL DES OPERATIONS' in text:
                am = AMT_TEXT.findall(text)
                if len(am) >= 2:
                    printed = (_val(am[-2]), _val(am[-1]))

    elif cm:
        bank, acct = 'CM', (iban[-5:] if iban != '?' else '?')
        cur = None
        for text, cells in rows:
            amts = [(cx, cs.strip()) for cx, cs in cells if AMT_CELL.match(cs.strip())]
            m = re.match(r'^(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+(.*)$', text)
            if m and amts:
                lab = re.sub(r'\s+\d{1,3}(?:\.\d{3})*,\d{2}.*$', '', m.group(3)).strip()
                d = m.group(1)
                for cx, a in amts:
                    cur = {'date': f'{d[6:10]}-{d[3:5]}-{d[0:2]}',
                           'sens': 'D' if cx < COLUMN_X_SPLIT else 'C', 'amt': _val(a),
                           'label': lab, 'detail': '', 'bank': bank, 'acct': acct}
                    txns.append(cur)
            elif cur is not None and not amts and not any(p in text[:18] for p in CM_SKIP):
                cur['detail'] = (cur['detail'] + ' ' + text).strip()[:200]
            if 'Total des mouvements' in text and amts:
                printed = (_val(amts[-2][1]), _val(amts[-1][1]))
    else:
        return None

    return {'bank': bank, 'acct': acct, 'txns': txns, 'printed': printed, 'source': source}


def main(paths):
    w = csv.writer(sys.stdout, delimiter=';')
    w.writerow(['Date', 'Banque', 'Compte', 'Sens', 'Montant', 'Libelle', 'Detail', 'Source'])
    for path in paths:
        raw = open(path, 'rb').read()
        r = parse(raw, source=path)
        if not r:
            sys.stderr.write(f"{path}: banque non reconnue, ignoré\n")
            continue
        D = round(sum(t['amt'] for t in r['txns'] if t['sens'] == 'D'), 2)
        C = round(sum(t['amt'] for t in r['txns'] if t['sens'] == 'C'), 2)
        pr = r['printed']
        ok = pr[0] is not None and abs(D - pr[0]) < 0.01 and abs(C - pr[1]) < 0.01
        sys.stderr.write(f"{path}: {r['bank']} {r['acct']} | {len(r['txns'])} op | "
                         f"Débit {D:,.2f} / Crédit {C:,.2f} | "
                         f"{'validé OK' if ok else 'VALIDATION ÉCHEC ' + str(pr)}\n")
        for t in r['txns']:
            w.writerow([t['date'], t['bank'], t['acct'], 'Débit' if t['sens'] == 'D' else 'Crédit',
                        f"{t['amt']:.2f}".replace('.', ','), t['label'], t['detail'][:150], path])


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
