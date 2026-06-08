#!/usr/bin/env python3
"""
Parseur de relevés Crédit Mutuel (C/C EUROCOMPTE PRO MAKI ONE) → ledger propre.

Contexte : l'import existant dans le Sheet « SUIVI DES DÉPENSES » est cassé
(montant collé dans la chaîne de date, date d'opération inexploitable, colonnes
« montant » contenant en réalité le solde cumulé). Ce script reconstruit un
ledger fiable directement depuis les PDF de relevés.

Méthode :
  1. Décompression des flux PDF (FlateDecode) via zlib — aucune dépendance externe.
  2. Extraction du texte AVEC ses coordonnées (opérateurs Tm/Td/TD + Tj/TJ).
  3. Le signe Débit/Crédit est déterminé par la COLONNE (position X) du montant :
        x < 480  → Débit   |   x >= 480 → Crédit
  4. Déduplication (le PDF rend chaque glyphe deux fois) + on ne compte que les
     lignes d'opération (commençant par « JJ/MM/AAAA JJ/MM/AAAA »).
  5. Validation : la somme Débit / Crédit reconstruite est comparée au total
     imprimé « Total des mouvements » de chaque relevé (doit correspondre au centime).

Usage :
    python3 parse_releve_cm.py releve1.pdf [releve2.pdf ...] > ledger.csv
"""
import sys, re, zlib, csv
from collections import defaultdict

AMT = re.compile(r'^\d{1,3}(?:\.\d{3})*,\d{2}$')
DATE2 = re.compile(r'^(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+(.*)$')
OPS = re.compile(
    rb'\[(?:[^\]\\]|\\.)*\]\s*TJ|\((?:[^()\\]|\\.)*\)\s*Tj'
    rb'|(?:-?\d*\.?\d+\s+){5}-?\d*\.?\d+\s+Tm'
    rb'|-?\d*\.?\d+\s+-?\d*\.?\d+\s+(?:Td|TD)|BT')
SKIP = ('Information sur', 'Sous réserve', 'CAISSE DE CREDIT', 'RELEVE ET INFORMATIONS',
        'C/C EUROCOMPTE', 'Date Date valeur', '(GE)', 'Page ', 'CCM HAUTE',
        '\\<\\<', 'QXBAN', 'Vous disposez', 'MAKI ONE 29', '06505 10278')
COLUMN_X_SPLIT = 480  # X frontier between Débit (left) and Crédit (right) columns


def _unescape(b):
    return b.replace(b'\\(', b'(').replace(b'\\)', b')').replace(b'\\\\', b'\\')


def _val(s):
    return float(s.replace('.', '').replace(',', '.'))


def _streams(raw):
    out = []
    for s in re.findall(rb'stream\r?\n(.*?)\r?\nendstream', raw, re.DOTALL):
        try:
            out.append(zlib.decompress(s))
        except Exception:
            pass
    return out


def parse_pdf(path):
    """Return (transactions, printed_totals). transactions: list of dicts."""
    raw = open(path, 'rb').read()
    txns = []
    printed = None
    for cs in _streams(raw):
        seen = set()
        rows = defaultdict(list)
        x = y = lx = ly = 0.0
        for m in OPS.finditer(cs):
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
                if key in seen:        # PDF renders every glyph twice
                    continue
                seen.add(key)
                rows[round(y)].append((x, s))
        cur = None
        for yy in sorted(rows, reverse=True):
            cells = sorted(rows[yy])
            text = ' '.join(c[1] for c in cells).strip()
            if not text or any(p in text[:20] for p in SKIP):
                continue
            amts = [(cx, cs.strip()) for cx, cs in cells if AMT.match(cs.strip())]
            m = DATE2.match(text)
            if m and amts:
                label = re.sub(r'\s+\d{1,3}(?:\.\d{3})*,\d{2}.*$', '', m.group(3)).strip()
                for cx, a in amts:
                    cur = {'date': m.group(1), 'vdate': m.group(2),
                           'sens': 'D' if cx < COLUMN_X_SPLIT else 'C',
                           'montant': _val(a), 'libelle': label, 'detail': ''}
                    txns.append(cur)
            elif cur is not None and not amts:
                cur['detail'] = (cur['detail'] + ' ' + text).strip()
            if 'Total des mouvements' in text and len(amts) >= 2:
                printed = tuple(_val(a) for _, a in amts[-2:])
    return txns, printed


def main(paths):
    w = csv.writer(sys.stdout, delimiter=';')
    w.writerow(['Date', 'Date valeur', 'Sens', 'Montant', 'Libelle', 'Detail', 'Source'])
    for path in paths:
        txns, printed = parse_pdf(path)
        D = round(sum(t['montant'] for t in txns if t['sens'] == 'D'), 2)
        C = round(sum(t['montant'] for t in txns if t['sens'] == 'C'), 2)
        ok = printed and abs(D - printed[0]) < 0.01 and abs(C - printed[1]) < 0.01
        sys.stderr.write(f"{path}: {len(txns)} opérations | Débit {D:,.2f} / Crédit {C:,.2f} "
                         f"| validation {'OK' if ok else 'ÉCHEC ' + str(printed)}\n")
        for t in txns:
            w.writerow([t['date'], t['vdate'], 'Débit' if t['sens'] == 'D' else 'Crédit',
                        f"{t['montant']:.2f}".replace('.', ','), t['libelle'], t['detail'][:150], path])


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
