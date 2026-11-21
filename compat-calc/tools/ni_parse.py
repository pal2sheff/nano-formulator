"""Разбор справочника аптеки Nano Identica (markdown-карточки) в список словарей.

Карточка начинается строкой «**Рус / English**» (иногда с номером «110.»), дальше разделы
«* **Раздел:**» и пункты «  + Ключ: значение» (ключ может отсутствовать).
"""
import re

SECTIONS = {'Название': 'name', 'Органолептика': 'org', 'Условия хранения': 'store',
            'Физ-хим свойства': 'phys', 'Растворимость': 'sol', 'Совместимые консерванты и антиоксиданты': 'pa'}


def parse(path):
    L = open(path, encoding='utf-8').read().split('\n')
    cards, cur, sec = [], None, None
    for i, raw in enumerate(L):
        s = raw.rstrip()
        m = re.match(r'^\*\*([^*].*?)\*\*\s*$', s)
        if m:
            t = re.sub(r'^[\d.\s]+(?=\D)', '', m.group(1)).strip()
            cur = {'title': t, 'line': i + 1, 's': {}, 'raw': []}
            cards.append(cur); sec = None; continue
        if cur is None or not s.strip():
            continue
        cur['raw'].append(s)
        m = re.match(r'^\* \*\*(.+?)\*\*\s*(.*)$', s)
        if m:
            sec = SECTIONS.get(m.group(1).strip(' :'), m.group(1).strip(' :'))
            cur['s'].setdefault(sec, [])
            if m.group(2).strip():
                cur['s'][sec].append((None, clean(m.group(2))))
            continue
        m = re.match(r'^\s*[+*-] (.+)$', s)
        txt = clean(m.group(1) if m else s)
        if sec is None:
            sec = 'note'; cur['s'].setdefault(sec, [])
        k = re.match(r'^([^:]{2,80}):\s*(.*)$', txt)
        if k and not re.search(r'\d$', k.group(1)):
            cur['s'][sec].append((k.group(1).strip(), k.group(2).strip()))
        else:
            cur['s'][sec].append((None, txt))
    return cards


def clean(t):
    return re.sub(r'\s+', ' ', t.replace('*', '')).strip()


def get(c, sec, *prefixes, exact=False):
    out = []
    for k, v in c['s'].get(sec, []):
        if k and any((k == p) if exact else k.startswith(p) for p in prefixes):
            out.append(v)
    return '; '.join(out)


def num(s):
    return float(s.replace(',', '.'))


NUM = r'(\d+(?:[.,]\d+)?)'


def ph_range(s):
    """Первый диапазон pH из текста: «4,0–7,0» → [4.0, 7.0]; «< 7» / «около 5» → по одной границе."""
    if not s:
        return None
    t = s.replace('−', '-').replace('—', '–')
    m = re.search(NUM + r'\s*(?:–|-|до)\s*' + NUM, t)
    if m:
        a, b = num(m.group(1)), num(m.group(2))
        if 0 <= a < b <= 14:
            return [a, b]
    m = re.search(r'(?:<|≤|ниже|не выше|до)\s*' + NUM, t)
    if m and 0 < num(m.group(1)) <= 14:
        return [0, num(m.group(1))]
    m = re.search(r'(?:>|≥|выше|не ниже|от)\s*' + NUM, t)
    if m and 0 < num(m.group(1)) <= 14:
        return [num(m.group(1)), 14]
    m = re.search(NUM, t)
    if m and 0 < num(m.group(1)) <= 14:
        v = num(m.group(1)); return [round(v - 0.5, 1), round(v + 0.5, 1)]
    return None


def heat_max(s):
    """Допустимая температура, °C: наименьший порог из «выше X °C», «до X °C», «> X °C», «T > X»."""
    if not s:
        return None
    t = s.replace('−', '-').replace('—', '–')
    vals = []
    for m in re.finditer(r'(?:выше|до|не более|не выше|превыша\w*|более|свыше|>|≥|≤|<|T\s*>)\s*(\d{2,3})(?:\s*[–-]\s*(\d{2,3}))?\s*°?\s*[CС]', t):
        vals.append(int(m.group(1)))
    if not vals:
        for m in re.finditer(r'(\d{2,3})(?:\s*[–-]\s*(\d{2,3}))?\s*°\s*[CС]', t):
            vals.append(int(m.group(1)))
    vals = [v for v in vals if 25 <= v <= 300]
    return min(vals) if vals else None


SOLV = [('вод', 'water'), ('этанол', 'ethanol'), ('спирт', 'ethanol'), ('пропиленгликол', 'pg'), ('глицерин', 'glycerin'),
        ('масл', 'oil'), ('mct', 'oil'), ('триглицерид', 'oil'), ('дмсо', 'dmso'), ('dmso', 'dmso'), ('пэг', 'peg'), ('peg', 'peg'),
        ('полисорбат', 'ps80'), ('твин', 'ps80'), ('хлороформ', 'org'), ('гексан', 'org'), ('эфир', 'org'), ('ацетон', 'org')]


def solv_codes(s):
    t = (s or '').lower()
    t = re.sub(r'бензилов\w* спирт\w*|спирт\w* бензилов\w*|(?:цетил|стеарил|цетостеарил|феноксиэтил)\w* спирт\w*|жирн\w+ спирт\w*', ' ', t)
    out = []
    for w, c in SOLV:
        if c == 'water' and not re.search(r'(?<![а-я])вод[аеуыоя]|(?<![а-я])водн|водо', t):
            continue
        if w in t and c not in out:
            out.append(c)
    return out


def conc(s):
    """Предельная концентрация → {v: мг/мл, solv, tx} по первому числу с единицей."""
    if not s:
        return None
    t = s.replace(',', '.').replace('−', '-').replace('—', '–')
    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:[–-]\s*(\d+(?:\.\d+)?))?\s*(мг/мл|мг/л|г/л|г/мл|г/100\s*мл|мг/г|%|г/кг)', t)
    if not m:
        return {'v': None, 'solv': '', 'tx': s}
    v = float(m.group(1)); u = re.sub(r'\s', '', m.group(3))
    k = {'мг/мл': 1, 'мг/л': 0.001, 'г/л': 1, 'г/мл': 1000, 'г/100мл': 10, 'мг/г': 1, '%': 10, 'г/кг': 1}[u]
    seg = t[max(0, m.start() - 60): m.end() + 60].lower()
    sc = solv_codes(seg)
    return {'v': round(v * k, 3), 'solv': sc[0] if sc else 'water', 'tx': s}


def mw(s):
    m = re.search(r'(\d[\d\s]*(?:[.,]\d+)?)\s*(?:г/моль|Да|kDa|кДа)', s or '')
    if not m:
        return None
    v = num(m.group(1).replace(' ', ''))
    if re.search(r'kDa|кДа', s[m.start():m.end()]):
        v *= 1000
    return v
