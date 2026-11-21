"""Импорт технологических карточек аптеки Nano Identica в базу.

    python3 tools/import_ni_cards.py            (из папки compat-calc)

Читает data/spravochnik_nano_identica.md, добавляет в записи data/molecules.json блок `ni`
(прежние поля не меняет), создаёт недостающие записи и пишет отчёт data/merge_report.md.
Повторный запуск пересобирает блоки `ni` с нуля.
"""
import copy, json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ni_parse as P

ROOT = HERE.parent
DB = ROOT / 'data' / 'molecules.json'
SP = ROOT / 'data' / 'spravochnik_nano_identica.md'
REPORT = ROOT / 'data' / 'merge_report.md'
SITE = ROOT / 'data' / 'site_catalog.json'

# Ручное сопоставление: начало заголовка карточки → id (там, где по названию не находится или находится неоднозначно)
MANUAL = [
    ('Лиофилизированный порошок геля алоэ', 'aloe'), ('Экстракт Фадогии', 'fadogia'), ('Экстракт родиолы', 'rhodiola'),
    ('Витамин B9 (L-5-метилтетрагидрофолат)', 'mthf'), ('L-5-Метилтетрагидрофолат', 'mthf'), ('Экстракт василька', 'cornflower'),
    ('Экстракт босвеллии', 'boswellia'), ('Липосомальный L-Глутатион', 'gsh_lipo'), ('PQQ (Пирролохинолинхинон)', 'pqq'),
    ('Витамин B14', 'pqq'), ('Витамин B6', 'pyridox'), ('Магний цитрат безводный', 'mgcit'), ('Витамин B3 (Ниацин', 'niacin'),
    ('Экстракт мукуны жгучей', 'mucuna'), ('Мукуна жгучая', 'mucuna'), ('L-ДОФА (Экстракт', 'ldopa'), ('Липосомальный NAD+', 'nad_lipo'),
    ('Витамины P', 'citrus'), ('Бета-гидроксибутират', 'cabhb'), ('Йод (Калия йодид', 'ki'), ('N-ацетил-D-(+)-глюкозамин', 'nag'), ('Докозагексаеновая кислота', 'dha'),
]

# Консерванты и антиоксиданты в тексте карточек → ключи (id базы, где вещество в базе есть)
PRES = [(r'бензоат|бензойн', 'nabenz'), (r'сорбат|сорбинов', 'ksorb'), (r'парабен|нипагин|нипазол|гидроксибензоат', 'mparaben'),
        (r'бензилов\w* спирт|спирт\w* бензилов', 'benzylalc'), (r'феноксиэтанол', 'phenoxy'), (r'дегидроуксус', 'dehydroacetic'),
        (r'этилгексилглицерин', 'ehg'), (r'бензалкони|хлоргексидин|цетримид', 'quat'), (r'хлорбутанол', 'chlorobutanol')]
ANTI = [(r'токоферол|витамин[а]? e(?![a-zа-я])', 'tocoph'), (r'аскорбил\s*пальмитат', 'ascpalm'), (r'метабисульфит|бисульфит|сульфит', 'metabisulfite'),
        (r'эдта|эдетат|edta', 'edta'), (r'аскорбинов|витамин[а]? c(?![a-zа-я])|аскорбат', 'vitc'), (r'лимонн', 'citric'),
        (r'bht|бгт|бутилгидрокситолуол', 'bht'), (r'(?<![a-zа-я])bha(?![a-zа-я])|бутилгидроксианизол', 'bha'), (r'розмарин', 'rosemary'),
        (r'цистеин', 'cysteine'), (r'тиосульфат', 'thiosulfate')]
PA_NAMES = {'nabenz': 'натрия бензоат', 'ksorb': 'калия сорбат', 'mparaben': 'парабены', 'benzylalc': 'бензиловый спирт', 'phenoxy': 'феноксиэтанол',
            'dehydroacetic': 'дегидроуксусная кислота', 'ehg': 'этилгексилглицерин', 'quat': 'четвертичные аммониевые', 'chlorobutanol': 'хлорбутанол',
            'tocoph': 'токоферол', 'ascpalm': 'аскорбилпальмитат', 'metabisulfite': 'метабисульфит / сульфиты', 'edta': 'ЭДТА', 'vitc': 'аскорбиновая кислота',
            'citric': 'лимонная кислота', 'bht': 'BHT', 'bha': 'BHA', 'rosemary': 'экстракт розмарина', 'cysteine': 'цистеин', 'thiosulfate': 'тиосульфат'}
SOLV_N = {'water': 'вода', 'ethanol': 'этанол', 'pg': 'пропиленгликоль', 'glycerin': 'глицерин', 'oil': 'масла', 'dmso': 'ДМСО',
          'peg': 'ПЭГ', 'ps80': 'полисорбат', 'org': 'органические растворители'}


def keys_in(text, table):
    t = (text or '').lower(); out = []
    for rx, k in table:
        if re.search(rx, t) and k not in out:
            out.append(k)
    return out


def norm(s):
    return re.sub(r'[^a-zа-я0-9]', '', (s or '').lower().replace('ё', 'е'))


def build_index(db, site):
    idx = {}
    def add(k, i):
        if len(norm(k)) > 3:
            idx.setdefault(norm(k), set()).add(i)
    for m in db:
        syn = m.get('syn') or ''
        syn = syn.split(';') if isinstance(syn, str) else syn
        for k in [m.get('ru', ''), m.get('en', '')] + syn + re.split(r'[()/,;]', m.get('ru', '') + '/' + m.get('en', '')):
            add(k, m['id'])
    for k, v in site['mols'].items():
        if v.get('id'):
            add(k, v['id'])
    return idx


def match(card, idx):
    for pre, i in MANUAL:
        if card['title'].startswith(pre):
            return i, 'вручную'
    hits = set()
    for p in [card['title']] + re.split(r'[()/|,;]', card['title']):
        if norm(p) in idx:
            hits |= idx[norm(p)]
    if len(hits) == 1:
        return hits.pop(), 'по названию'
    return None, ('неоднозначно: ' + ', '.join(sorted(hits))) if hits else 'не найдено'


def card_ni(c):
    """Поля блока ni из одной карточки."""
    g = lambda sec, *p, **kw: P.get(c, sec, *p, **kw)
    ni = {}
    cas = g('name', 'CAS');  inci = g('name', 'INCI', 'Систематическое', 'Идентификатор')
    if cas: ni['cas'] = cas
    if inci: ni['inci'] = inci
    org = {k: g('org', n) for k, n in (('c', 'Цвет'), ('t', 'Вкус'), ('s', 'Запах'))}
    if any(org.values()): ni['organo'] = {k: v for k, v in org.items() if v}
    st = '. '.join(x.rstrip('. ;') for x in (g('store', 'Температура', exact=True), g('store', 'Дополнительно')) if x)
    if st: ni['storage'] = st
    state = g('phys', 'Физическое состояние')
    if state: ni['state'] = state
    mw = P.mw(g('phys', 'Молекулярная масса'))
    if mw: ni['mw'] = mw
    pht = g('phys', 'pH стабильности') or g('phys', 'pH растворов')
    if pht:
        ni['ph_tx'] = pht
        r = P.ph_range(pht)
        if r: ni['ph_ni'] = r
    ht = g('phys', 'Термолабильность')
    if ht:
        ni['heat_tx'] = ht
        h = P.heat_max(ht)
        if h: ni['heat_ni'] = h
        elif re.match(r'(очень |крайне |чрезвычайно )?высокая|термолабил|быстро разлага', ht.lower()): ni['heat_q'] = 'high'
    sv = g('sol', 'Оптимальные растворители', 'Растворим', 'Водорастворимые', 'Жирорастворимые', 'Водные', 'СО2', 'Масляные', 'В воде', 'Умеренно')
    if sv:
        ni['solv_tx'] = sv; ni['solvents'] = P.solv_codes(sv)
    ins = g('sol', 'Нерастворим', 'Практически нерастворим', 'Малорастворим', 'Плохо растворим', 'Разрушается')
    if ins:
        ni['insol_tx'] = ins; ni['insol'] = P.solv_codes(ins)
    cm = g('sol', 'Предельная концентрация')
    if cm:
        ni['conc_max'] = P.conc(cm)
    inc = '; '.join(v for sec in c['s'] for k, v in c['s'][sec] if k and k.startswith('Ограничения'))
    if inc: ni['incompat_ni'] = inc
    pa = [(k, v) for k, v in c['s'].get('pa', []) if not (k and k.startswith('Ограничения'))]
    if pa:
        tx = '; '.join((k + ': ' if k else '') + v for k, v in pa)
        ni['pa_tx'] = tx
        ni['preserv_ok'] = keys_in(tx, PRES)
        ni['antiox_ok'] = keys_in(tx, ANTI)
        if re.search(r'все стандартные|любые стандартные|совместим со всеми|стандартные консерванты', tx.lower()):
            ni['pa_any'] = True
    if inc:
        bad = keys_in(inc, PRES) + keys_in(inc, ANTI)
        if bad: ni['pa_bad'] = bad
    return ni


def merge(cards):
    """Несколько редакций одного вещества: за основу берём наиболее полную, недостающее — из остальных.
    pH — пересечение диапазонов (строже), температура — наименьшая."""
    eds = sorted(cards, key=lambda x: -len(x['ni']))
    ni = copy.deepcopy(eds[0]['ni'])
    for e in eds[1:]:
        for k, v in e['ni'].items():
            ni.setdefault(k, v)
    phs = [e['ni']['ph_ni'] for e in eds if 'ph_ni' in e['ni']]
    if len(phs) > 1:
        lo, hi = max(p[0] for p in phs), min(p[1] for p in phs)
        if lo < hi: ni['ph_ni'] = [lo, hi]
    hs = [e['ni']['heat_ni'] for e in eds if 'heat_ni' in e['ni']]
    if hs: ni['heat_ni'] = min(hs)
    for k in ('preserv_ok', 'antiox_ok', 'pa_bad', 'solvents', 'insol'):
        vals = [x for e in eds for x in e['ni'].get(k, [])]
        if vals: ni[k] = list(dict.fromkeys(vals))
    ni['name'] = eds[0]['title']
    if len(eds) > 1:
        ni['eds'] = len(eds)
    return ni


def fmt_ph(r):
    return '—' if not r else f'{r[0]:g}–{r[1]:g}'


def main():
    db = json.loads(DB.read_text(encoding='utf-8'))
    site = json.loads(SITE.read_text(encoding='utf-8'))
    by = {m['id']: m for m in db}
    for m in db:
        m.pop('ni', None)
    cards = P.parse(SP)
    idx = build_index(db, site)

    # ---- новые записи ----
    new = ['nad_lipo']
    if 'nad_lipo' not in by:
        b = copy.deepcopy(by['nad'])
        for k in ('pharm', 's0', 'sp', 'ab', 'p1', 'poly', 'salt', 'iso'):
            b.pop(k, None)
        tags = [t for t in b.get('tags', '').split() if t not in ('lipo', 'baselabile')]
        b.update(id='nad_lipo', base='nad', ru='НАД+ липосомальный', en='Liposomal NAD+', kind='formulation', sw=50, ab='', sp=[], ph=[6.0, 7.0],
                 tags=' '.join(tags + ['liposome']),
                 clin='Готовая липосомальная система (фосфолипидные везикулы): вещество диспергируется в воде. Липосомы разрушаются этанолом, ПАВ, '
                      'замораживанием и нагревом > 40 °C. ' + by['nad'].get('clin', ''),
                 pharm={'bf': 'жидкость', 'pc': 'повышает клеточную энергию', 'eff': 'повышает клеточную энергию (липосомальная форма)'},
                 syn='Липосомальный NAD+; liposomal NAD', st='ox1 hy2 he3 li1 mo1')
        db.append(b); by['nad_lipo'] = b

    # ---- сопоставление ----
    res = []
    for c in cards:
        i, how = match(c, idx)
        stub = any('Повторный элемент' in v for sec in c['s'].values() for k, v in sec)
        res.append({'c': c, 'id': i, 'how': how, 'stub': stub, 'title': c['title'], 'ni': {} if stub else card_ni(c)})
    groups = {}
    for r in res:
        if r['id'] and not r['stub']:
            groups.setdefault(r['id'], []).append(r)
    for i, g in groups.items():
        by[i]['ni'] = merge(g)

    # ---- трактовка аптеки: B14 = PQQ, витамин E = DL-α-токоферол ----
    pqq = by['pqq']
    if 'Витамин B14' not in (pqq.get('syn') or ''):
        pqq['syn'] = (pqq.get('syn') + '; ' if pqq.get('syn') else '') + 'Витамин B14; Vitamin B14'
    pqq['ni']['alias'] = 'В номенклатуре аптеки «витамин B14» = PQQ (пирролохинолинхинон).'
    b14 = by['b14']
    b14['base'] = 'pqq'
    b14['ni'] = dict(copy.deepcopy(pqq['ni']), alias='В аптеке Nano Identica под «витамином B14» отпускается PQQ (пирролохинолинхинон): '
                     'правила совместимости берутся от PQQ, карточка аптеки — общая с PQQ.', name='Витамин B14 (Пирролохинолинхинон / PQQ)')
    vite = by['vite']
    vite['ni']['alias'] = ('У аптеки витамин E — синтетический DL-α-токоферол (all-rac), а не природный d-α (RRR): '
                           'по активности 1 мг dl-α-токоферола ≈ 1,1 МЕ против 1,49 МЕ у d-α (≈ 0,74 от природного). '
                           'Физико-химические свойства (растворимость, окисляемость) у форм одинаковы.')
    if 'DL-α' not in (vite.get('syn') or ''):
        vite['syn'] = (vite.get('syn') or '') + '; DL-α-токоферол; dl-alpha-tocopherol; all-rac-α-токоферол'

    # ---- сайт: «Витамин B14» → pqq, «Липосомальный NAD+» → nad_lipo ----
    for name, nid in (('Витамин B14', 'pqq'), ('Липосомальный NAD+', 'nad_lipo')):
        if name in site['mols']:
            site['mols'][name]['id'] = nid

    DB.write_text(json.dumps(db, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    SITE.write_text(json.dumps(site, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    write_report(res, groups, by, new)
    print(f'карточек {len(cards)}, совпало веществ {len(groups)}, новых записей {len(new)}, всего в базе {len(db)}')


def write_report(res, groups, by, new):
    L = ['# Справочник аптеки Nano Identica → база калькулятора', '',
         'Источник: `data/spravochnik_nano_identica.md`. Сборка: `python3 tools/import_ni_cards.py`. '
         'Данные аптеки записаны в блок `ni` каждой записи; прежние поля (`ph`, `sw`, `st` и др.) не изменены.', '']
    nm = sum(1 for r in res if r['id'])
    L += ['## Итог', '',
          f'- Карточек в справочнике: **{len(res)}**',
          f'- Сопоставлено с базой: **{nm}** карточек → **{len(groups)}** веществ',
          f'- Повторяющиеся вещества (2 и более карточек): **{sum(1 for g in groups.values() if len(g) > 1)}**',
          f'- Новых записей: **{len(new)}** ({", ".join(new) or "нет"})',
          f'- Не сопоставлено: **{sum(1 for r in res if not r["id"])}**', '']

    L += ['## Трактовка аптеки', '',
          '- **Витамин B14 = PQQ.** В базе была отдельная запись `b14` («витамин B14», состав неопределён). Теперь `b14` ссылается на PQQ (`base: pqq`) '
          'и получает правила совместимости PQQ; в синонимы `pqq` добавлено «Витамин B14». На сайте позиция «Витамин B14» сопоставлена с `pqq`. '
          'Карточка «Витамин B14» в справочнике — пустая отсылка к PQQ («Повторный элемент»).',
          '- **Витамин E = DL-α-токоферол (синтетический, all-rac).** Запись `vite` в базе описывала природный d-α-токоферол; название и поля не менялись, '
          'в блок `ni.alias` и в синонимы внесено, что аптека использует DL-форму. Пересчёт активности: 1 мг dl-α ≈ 1,1 МЕ, d-α — 1,49 МЕ. '
          'Если дозы на сайте указаны в мг DL-формы, по МЕ это ≈ 0,74 от природной формы. **Нужно решение: переименовать `vite` в DL-α-токоферол или оставить.**', '']

    L += ['## Новые записи', '',
          '- `nad_lipo` — **НАД+ липосомальный** (карточка «Липосомальный NAD+»). Раньше позиция сайта сопоставлялась с чистым `nad`; '
          'у липосомальной формы другие ограничения (нагрев > 40 °C, спирт, ПАВ, замораживание), поэтому сделана отдельная запись с `base: nad`, '
          'как у других липосомальных форм. Формула, SMILES и pKa не задавались (смесь вещества с фосфолипидами); `dose` взята от `nad`.',
          '- Пептиды **BPC-157, TB-500, GHK-Cu, Dihexa** в базе уже есть (`bpc157`, `tb500`, `ghkcu`, `dihexa`), поле `dose` у них пустое и не заполнялось. '
          'Карточки аптеки добавлены к ним как блок `ni`.',
          '- **TB-500: внимание.** В базе `tb500` — фрагмент тимозина β4 (Ac-LKKTEEQ, ≈ 889 Да); карточка аптеки описывает полный тимозин β4 '
          '(43 аминокислоты, ≈ 4963 Да). Это разные вещества с разной дозировкой и стабильностью. **Нужно решение:** что именно отпускает аптека '
          'под названием TB-500 — тогда запись будет исправлена или разделена на две.', '']

    L += ['## Повторяющиеся карточки', '',
          'Для вещества с несколькими редакциями за основу взята наиболее полная, недостающие поля дополнены из остальных; '
          'диапазон pH — пересечение (строже), допустимая температура — наименьшая.', '',
          '| Вещество (id) | Карточки (строка в справочнике) | pH по редакциям | Нагрев, °C по редакциям |', '|---|---|---|---|']
    for i, g in sorted(groups.items(), key=lambda x: x[0]):
        if len(g) > 1:
            L.append(f'| {by[i]["ru"]} (`{i}`) | ' + '<br>'.join(f'{r["title"]} ({r["c"]["line"]})' for r in g) + ' | '
                     + ' / '.join(fmt_ph(r['ni'].get('ph_ni')) for r in g) + ' | ' + ' / '.join(str(r['ni'].get('heat_ni', '—')) for r in g) + ' |')
    stubs = [r for r in res if r['stub']]
    if stubs:
        L += ['', 'Пустые карточки-отсылки («Повторный элемент…»): ' + ', '.join(f'{r["title"]} ({r["c"]["line"]})' for r in stubs) + '.']
    L.append('')

    # ---- расхождения ----
    phd, phn, swd, mwd = [], [], [], []
    for i in sorted(groups):
        m = by[i]; ni = m['ni']
        a, b = m.get('ph'), ni.get('ph_ni')
        if a and b and b != [0, 14]:
            ov = max(0, min(a[1], b[1]) - max(a[0], b[0]))
            wide = (a[0] - b[0] >= 1) or (b[1] - a[1] >= 1)          # аптека считает стабильным то, что литература — нет
            if ov == 0 or wide or ov < 0.5 * (b[1] - b[0]):
                phd.append(f'| {m["ru"]} (`{i}`) | {fmt_ph(a)} | {fmt_ph(b)} | {ni.get("ph_tx", "")[:160]} |')
            elif abs(a[0] - b[0]) >= 1 or abs(a[1] - b[1]) >= 1:
                phn.append(f'{m["ru"]} `{i}` ({fmt_ph(a)} → {fmt_ph(b)})')
        sw = m.get('sw'); cm = ni.get('conc_max') or {}
        why = ''
        if sw is not None and cm.get('v') and cm.get('solv') == 'water' and m.get('kind') != 'formulation':
            r = cm['v'] / sw if sw else 1e9
            if r >= 5 or r <= 0.2:
                why = f'предельная концентрация в воде {cm["v"]:g} мг/мл против sw {sw:g} мг/мл'
        if not why and sw is not None:
            if 'water' in ni.get('insol', []) and 'water' not in ni.get('solvents', []) and sw >= 10:
                why = f'аптека: нерастворим в воде; в базе sw {sw:g} мг/мл'
            elif ni.get('solvents', [None])[:1] == ['water'] and sw < 0.1 and m.get('kind') not in ('extract', 'polymer', 'probiotic', 'formulation', 'enzyme', 'protein'):
                why = f'аптека: первый растворитель — вода; в базе sw {sw:g} мг/мл'
        if why:
            swd.append(f'| {m["ru"]} (`{i}`) | {why} | {(cm.get("tx") or ni.get("solv_tx") or ni.get("insol_tx") or "")[:140]} |')
        if ni.get('mw') and m.get('mw') and abs(ni['mw'] - m['mw']) / m['mw'] > 0.05 and m.get('kind') not in ('extract', 'polymer', 'probiotic', 'enzyme', 'protein'):
            mwd.append(f'| {m["ru"]} (`{i}`) | {m["mw"]:g} | {ni["mw"]:g} |')
    L += ['## Расхождения с литературными полями (решение за технологом)', '',
          f'### pH стабильности: заметные расхождения — {len(phd)}', '',
          'Диапазоны не пересекаются, пересекаются меньше чем наполовину, или аптека считает вещество стабильным за пределами литературного диапазона (на ≥ 1 ед.).', '',
          '| Вещество | `ph` (литература) | `ph_ni` (аптека) | Текст карточки |', '|---|---|---|---|'] + phd
    L += ['', f'### pH стабильности: аптека указывает более узкий диапазон внутри литературного (граница сдвинута на ≥ 1 ед.) — {len(phn)}', '',
          'Это не противоречие: калькулятор проверяет оба диапазона и пишет источник замечания.', '', '; '.join(phn) + '.']
    L += ['', f'### Растворимость в воде: `sw` базы и данные аптеки (в 5 и более раз) — {len(swd)}', '',
          'Предельная концентрация аптеки — практический предел ввода, а не всегда насыщение; сравнение ориентировочное.', '',
          '| Вещество | Расхождение | Текст карточки |', '|---|---|---|'] + swd
    L += ['', f'### Молярная масса отличается более чем на 5% (обычно другая соль или гидрат) — {len(mwd)}', '',
          '| Вещество | `mw` базы | Аптека |', '|---|---|---|'] + mwd

    L += ['', '## Сопоставление по карточкам', '', '| № | Карточка (строка) | id | Способ |', '|---|---|---|---|']
    for n, r in enumerate(res, 1):
        L.append(f'| {n} | {r["title"]} ({r["c"]["line"]}) | {"`" + r["id"] + "`" if r["id"] else "—"} | {r["how"]}{" (отсылка)" if r["stub"] else ""} |')
    L += ['', '## Как калькулятор использует данные аптеки', '',
          '- Карточка вещества: блок «Данные аптеки Nano Identica».',
          '- Проверка рецептуры: pH раствора против `ph_ni`, температура изготовления (основа троше, свечей, мармелада) против `heat_ni`, '
          'растворитель формы против `solvents`/`insol`, концентрация против `conc_max`, консерванты и антиоксиданты состава против `preserv_ok`/`antiox_ok`/`incompat_ni`.',
          '- У каждой проблемы указан источник: «данные аптеки» или «литература».', '']
    REPORT.write_text('\n'.join(L), encoding='utf-8')


if __name__ == '__main__':
    main()
