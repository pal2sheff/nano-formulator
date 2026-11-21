"""Импорт справочника конструктора заказов nano-identica.com (выгрузка из кабинета врача, Markdown)
в doctor/data/site_catalog.json: формы, дерево «вид терапии → категория → молекулы», дозы с зонами,
таблица несовместимостей (high / medium). Цены и готовые решения не переносятся.

Запуск: python3 doctor/tools/import_site_catalog.py <путь к .md>
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB = json.loads((ROOT / 'compat-calc' / 'data' / 'molecules.json').read_text(encoding='utf-8'))
OUT = ROOT / 'compat-calc' / 'data' / 'site_catalog.json'

FORMS = [  # код сайта → форма движка и параметры
    dict(code='КП', n='Капсулы', engine='caps', P={}),
    dict(code='СЛ', n='Сублингвальная форма (капли)', engine='drops', P={'sl': 1, 'vdose': 0.25}),
    dict(code='ТР', n='Троше (подъязычные пастилки)', engine='troche', P={'mass': 1.0}),
    dict(code='ГМ', n='Гамми (мармелад)', engine='gummy', P={}),
    dict(code='НС', n='Назальный спрей', engine='nasal', P={'vdose': 0.25}, vdoses=[0.25, 0.375, 0.5]),
    dict(code='ТД', n='Трансдермальный крем', engine='td', P={'mass': 1.0}),
    dict(code='КК', n='Косметический крем', engine='cream', P={'mass': 1.0}),
    dict(code='РС', n='Ректальные свечи', engine='supp', P={'mass': 1.88}),
    dict(code='ВС', n='Вагинальные свечи', engine='vag', P={'mass': 1.88}),
]
COURSE = {'НС': [15, 30, 45, 60], 'РС': [5, 15, 30, 60, 90, 120], 'ВС': [5, 15, 30, 60, 90, 120], 'КК': [10, 15, 30]}

# названия сайта, которые не сопоставляются автоматически (или сопоставляются неверно)
MANUAL = {
    'Липосомальный Транс-Ресвератрол': 'resv_lipo', 'Витамин B14': 'pqq', 'Липосомальный NAD+': 'nad_lipo', 'Экстракт гематококка': 'haemat', 'Силибинин': 'silibinin', 'Экстракт гриффонии': 'griffonia',
    'Экстракт коры сосны': 'pinebark', 'Экстракт папайи': 'papaya', 'Фосфатидилхолин (ПХ)': 'phospholip',  # у аптеки B14 = PQQ
    'Астаксантин': 'astax', 'Экстракт куркумы': 'curcumin',
    'АКГ (альфа-кетоглутарат)': 'akg', 'Альфа-GPC (альфа-глицерофосфохолин)': 'agpc', 'SAM-e (S-аденозилметионин)': 'same',
    'Экстракт пажитника': 'fenugreek', 'Экстракт трибулуса': 'tribulus', 'Экстракт дамианы': 'damiana', 'Экстракт эпимедиума': 'epimedium',
    'Докозагексаеновая кислота (DHA)': 'dha', 'Липосомальный Витамин C (аскорбиновая кислота)': 'vitc_lipo', 'Витамин B3 (Ниацин)': 'niacin',
    'Витамин B6 (Пиридоксин)': 'pyridox', 'Витамины P': 'citrus', 'Витамин B1 (Бенфотиамин)': 'benfo', 'Рибофлавин-5-фосфат': 'b2',
    'Магний цитрат': 'mgcit', 'Магния таурат': 'mgtaur', 'Диоксид кремния': 'sio2', 'Пальмитоилэтаноламид (PEA)': 'pea',
    'Селен (L-селенометионин)': 'semet', 'Железо фумарат': 'fefum', 'Кальций малат': 'camal', 'Кальций цитрат': 'cacit',
    'Хелат бисглицината железа': 'febis', 'L-Лизин HCl': 'lys', 'L-Орнитин HCl': 'orn', 'Бета-аланин': 'betaala',
    'Экстракт Роксбургской груши': 'roxpear', 'Экстракт ашваганды': 'ashwagandha', 'Экстракт астрагала': 'astragalus', 'Экстракт кошачьего когтя': 'catsclaw',
    'Пипер Лонгум': 'piperine', 'Экстракт джимнемы сильвестры': 'gymnema', 'Экстракт лимонника китайского': 'schisandra', 'Экстракт розмарина': 'rosemary',
    'Экстракт босвеллии серрата': 'boswellia', 'Экстракт женьшеня': 'ginseng', 'L-глутатион': 'gsh', 'Фисетин': 'fisetin', 'Эпигаллокатехин галлат (EGCG)': 'egcg',
    'Экстракт опунции': 'opuntia', 'Берберин HCl': 'berberine', 'Синефрина гидрохлорид': 'synephrine', 'Экстракт гарцинии камбоджийской': 'garcinia',
    'Экстракт цейлонской корицы': 'cinnamon', 'Экстракт момордики': 'bittermelon', 'Силимарин': 'silymarin', 'Экстракт одуванчика': 'dandelion',
    'Экстракт артишока': 'artichoke', 'Мальтадиастаза': 'maltdiast', 'TB-500': 'tb500', 'GHK-Cu': 'ghkcu', 'Дигекса': 'dihexa', 'Экстракт инжира': 'fig',
    'Экстракт галеги лекарственной': 'galega', 'Стевиозид': 'stevioside', 'Экстракт гардении': 'gardenia', 'Экстракт имбиря': 'ginger',
    'Экстракт базилика священного': 'tulsi', 'Экстракт сои': 'soy', 'Экстракт горечавки': 'gentian', 'Экстракт африканской сливы': 'pygeum',
    'Экстракт Со Пальметто': 'sawpalm', 'Экстракт красного клевера': 'redclover', 'Экстракт крапивы': 'nettle', 'Эвгенол': 'eugenol',
    'Экстракт ежовика гребенчатого': 'lionsmane', 'Экстракт вишни': 'cherry', 'D-манноза': 'dmannose', 'Экстракт конского каштана': 'horsechest',
    'Экстракт скользкого вяза': 'slipelm', 'Экстракт корня алтея': 'marshmallow', 'Экстракт бамии': 'okra', 'Экстракт чеснока': 'garlic',
    'Экстракт чистотела': 'celandine', 'Экстракт ромашки': 'chamomile', 'Экстракт гриффонии': 'htp', 'Урсодезоксихолевая кислота': 'udca',
    'Гиалуроновая кислота': 'hyaluronate',
    # исправления автоматического сопоставления
    'Метиленовый синий': 'methblue', 'Бетаин HCl': 'betainehcl', 'Экстракт семян тыквы': 'pumpkin', 'Экстракт листа подорожника': 'plantain',
    'Экстракт подорожника': 'psyllium', 'Фосфатидилхолин (ПХ)': 'sflecithin', 'Йод': 'ki', 'Подсолнечный лецитин': 'sflecithin',
}


def norm(s):
    s = s.lower().replace('ё', 'е')
    s = re.sub(r'(экстракт\w*|extract|липосомальн\w*|биоидентичн\w*|\(.*?\))', ' ', s)
    return re.sub(r'[^a-zа-я0-9]+', ' ', s).strip()


def auto_id(name):
    idx = []
    for m in DB:
        if m['kind'] == 'excipient': continue
        for s in [m['ru'], m['en'], m['id']] + (m.get('syn') or '').split(';'):
            k = norm(s)
            if k: idx.append((k, m['id']))
    k = norm(name)
    hit = {i for kk, i in idx if kk == k}
    if not hit:
        ws = [w for w in k.split() if len(w) > 2]
        hit = {i for kk, i in idx if ws and all(w in kk for w in ws)}
    if not hit:
        ws = [w for w in k.split() if len(w) > 3]
        hit = {i for kk, i in idx if ws and any(w in kk.split() for w in ws)}
    return hit.pop() if len(hit) == 1 else None


def main(md):
    L = Path(md).read_text(encoding='utf-8').split('\n')
    codes = {f['code'] for f in FORMS}
    tree, mols, th, cat, sec = [], {}, None, None, False
    for l in L:
        if l.startswith('## 5.'): sec = True; continue
        if l.startswith('## 6.'): break
        if not sec: continue
        m = re.match(r'^### (.+)$', l)
        if m:
            th = {'n': m.group(1).strip(), 'cats': []}; tree.append(th); cat = None; continue
        m = re.match(r'^#### (.+?) \(\d+\)$', l)
        if m:
            cat = {'n': m.group(1).strip(), 'mols': []}; th['cats'].append(cat); continue
        m = re.match(r'^- \*\*(.+?)\*\* — (.+)$', l)
        if not m: continue
        name = m.group(1).strip()
        doses = {}
        for part in m.group(2).split('; '):
            d = re.match(r'^(\S\S) ([\d.]+)/([\d.]+)/([\d.]+) \(max ([\d.]+)\) (.+?)\s*$', part.strip())
            if d and d.group(1) in codes:
                doses[d.group(1)] = [float(d.group(2)), float(d.group(3)), float(d.group(4)), float(d.group(5)), d.group(6)]
        if cat is None:
            cat = {'n': 'Только через поиск', 'mols': []}; th['cats'].append(cat)
        cat['mols'].append(name)
        mid = MANUAL.get(name) or auto_id(name)
        if not mid: sys.exit('Не сопоставлено: ' + name)
        mols[name] = {'id': mid, 'd': doses}
    # таблица несовместимостей
    i = next(n for n, l in enumerate(L) if l.startswith('## Приложение B'))
    rev = {}
    for n, v in mols.items(): rev.setdefault(n, v['id'])
    inc = {'high': set(), 'medium': set()}
    for l in L[i:]:
        m = re.match(r'^\| (.+?) \| (.+?) \| (.+?) \| (.+?) \|$', l)
        if not m or m.group(1) in ('Молекула', '---'): continue
        a = rev.get(m.group(1))
        for lvl, col in (('high', 2), ('medium', 3)):
            if m.group(col).strip() == '—': continue
            for b in m.group(col).split(', '):
                b = rev.get(b.strip())
                if a and b and a != b: inc[lvl].add(tuple(sorted((a, b))))
    inc['medium'] -= inc['high']
    tree = [t for t in tree if not t['n'].startswith('Вне дерева')] + [t for t in tree if t['n'].startswith('Вне дерева')]
    out = {'source': 'Конструктор заказов nano-identica.com, кабинет врача, 15.11.2026', 'forms': FORMS, 'course': COURSE,
           'tree': tree, 'mols': mols, 'incompat': {k: sorted(v) for k, v in inc.items()}}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    ids = {v['id'] for v in mols.values()}
    print(f"молекул сайта: {len(mols)}, id базы: {len(ids)}, несовместимостей: high {len(inc['high'])}, medium {len(inc['medium'])}")


if __name__ == '__main__':
    main(sys.argv[1])
