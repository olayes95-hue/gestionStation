#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Import WhatsApp -> SQL d'actualisation de l'app.

Usage :
    python3 tools/import_whatsapp.py "/chemin/vers/_chat.txt" [--station 1] [--depuis 2026-06-29]

Génère un fichier import_new.sql (upsert dans daily_reports) à lancer dans
Supabase > SQL Editor. Déduplique par (station, date) : réexécutable sans doublon.
Ne concerne que les points journaliers (ventes/stock) présents dans le TEXTE du chat.
"""
import re, sys, argparse, datetime
from collections import defaultdict

# gère 12h (AM/PM) ET 24h ; séparateur espace ou virgule ; espaces spéciaux
HEAD = re.compile(r'^‎?\[(\d{2})/(\d{2})/(\d{4})[ ,  ]+(\d{1,2}):(\d{2}):(\d{2})[   ]*([AP]M)?\]\s*([^:]+?):\s?(.*)$')
MONEY = r'\*?\s*([0-9][0-9 .]*[0-9]|[0-9])'

def num(s):
    if s is None: return None
    s = re.sub(r'[^0-9]', '', str(s))
    return int(s) if s else None

def load_messages(path):
    msgs, cur = [], None
    for raw in open(path, encoding='utf-8'):
        line = raw.rstrip('\n')
        m = HEAD.match(line)
        if m:
            if cur: msgs.append(cur)
            dd, mm, yyyy, h, mi, s, ap, sender, text = m.groups()
            h = int(h)
            if ap == 'PM' and h != 12: h += 12
            elif ap == 'AM' and h == 12: h = 0
            cur = {'date': f'{yyyy}-{mm}-{dd}', 'sender': sender.strip(), 'text': text}
        elif cur is not None:
            cur['text'] += '\n'+line
    if cur: msgs.append(cur)
    return msgs

def report_date(text, msgdate):
    md = datetime.date.fromisoformat(msgdate)
    m = re.search(r'Point\s+d[ue]\s+(\d{1,2})[/](\d{1,2})(?:[/](\d{2,4}))?', text, re.I)
    if not m: return None
    d, mo = int(m.group(1)), int(m.group(2))
    y = md.year if not m.group(3) else (2000+int(m.group(3)) if len(m.group(3))==2 else int(m.group(3)))
    try: rd = datetime.date(y, mo, d)
    except: return None
    if abs((md-rd).days) > 40:
        try:
            rd2 = datetime.date(md.year, mo, d)
            if abs((md-rd2).days) <= 40: rd = rd2
            else: return None
        except: return None
    return rd.isoformat()

def extract(msgs):
    points = []
    for m in msgs:
        t = m['text']
        if not re.search(r'Point\s+d[ue]\s+\d', t, re.I): continue
        rd = report_date(t, m['date'])
        if not rd: continue
        bons, esps = [], []
        for ln in t.split('\n'):
            if re.search(r'total\s*bon', ln, re.I): continue
            mb = re.search(r'\bBon\s*[:=]\s*'+MONEY, ln, re.I)
            if mb: bons.append(num(mb.group(1)))
            me = re.search(r'Esp[èeé]s?[cç]?e?\s*[:=]\s*'+MONEY, ln, re.I)
            if me: esps.append(num(me.group(1)))
        ess = re.search(r'Ess?(?:ence)?\.?\s*:?\s*([0-9][0-9 .]*)\s*[×xX*]\s*([0-9][0-9 .]*)\s*=\s*'+MONEY, t, re.I)
        gas = re.search(r'Gas(?:oil)?\.?\s*:?\s*([0-9][0-9 .]*)\s*[LlXx×* ]{0,3}[×xX*]\s*([0-9][0-9 .]*)\s*=\s*'+MONEY, t, re.I)
        tb = re.search(r'Total\s*Bon\s*[:=]?\s*'+MONEY, t, re.I)
        points.append({'report_date': rd,
            'ess_litres': num(ess.group(1)) if ess else None, 'ess_pu': num(ess.group(2)) if ess else None,
            'gas_litres': num(gas.group(1)) if gas else None, 'gas_pu': num(gas.group(2)) if gas else None,
            'ess_bon': sum(b for b in bons if b) if bons else None,
            'ess_espece': sum(e for e in esps if e) if esps else None,
            'total_bon_cumul': num(tb.group(1)) if tb else None,
            'score': (sum(b for b in bons if b) if bons else 0)+(sum(e for e in esps if e) if esps else 0)})
    # une ligne par date (la plus complète)
    best = {}
    for p in points:
        if p['report_date'] not in best or p['score'] > best[p['report_date']]['score']:
            best[p['report_date']] = p
    return best

def sqlval(v): return 'null' if v is None else str(v)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('chat'); ap.add_argument('--station', default='1'); ap.add_argument('--depuis', default=None)
    a = ap.parse_args()
    msgs = load_messages(a.chat)
    pts = extract(msgs)
    dates = sorted(pts)
    if a.depuis: dates = [d for d in dates if d > a.depuis]
    if not dates:
        print('Aucun nouveau point à importer.'); return
    out = ["-- Import WhatsApp -> app (upsert daily_reports). Lancer dans Supabase > SQL Editor.",
           f"-- {len(dates)} jour(s), du {dates[0]} au {dates[-1]}, station {a.station}."]
    out.append("insert into daily_reports (station_id, report_date, ess_litres, ess_pu, ess_bon, ess_espece, gas_litres, gas_pu, total_bon_cumul) values")
    rows = []
    for d in dates:
        p = pts[d]
        rows.append(f"({a.station},'{d}',{sqlval(p['ess_litres'])},{sqlval(p['ess_pu'])},{sqlval(p['ess_bon'])},"
                    f"{sqlval(p['ess_espece'])},{sqlval(p['gas_litres'])},{sqlval(p['gas_pu'])},{sqlval(p['total_bon_cumul'])})")
    out.append(",\n".join(rows))
    out.append("on conflict (station_id, report_date) do update set "
               "ess_litres=excluded.ess_litres, ess_pu=excluded.ess_pu, ess_bon=excluded.ess_bon, "
               "ess_espece=excluded.ess_espece, gas_litres=excluded.gas_litres, gas_pu=excluded.gas_pu, "
               "total_bon_cumul=excluded.total_bon_cumul;")
    open('import_new.sql', 'w').write("\n".join(out))
    tot_bon = sum(pts[d]['ess_bon'] or 0 for d in dates)
    tot_esp = sum(pts[d]['ess_espece'] or 0 for d in dates)
    print(f"OK -> import_new.sql : {len(dates)} jours ({dates[0]} -> {dates[-1]})")
    print(f"   Bon cumulé: {tot_bon:,} F | Espèces cumulées: {tot_esp:,} F")
    print("   Lance ce fichier dans Supabase > SQL Editor.")

if __name__ == '__main__':
    main()
