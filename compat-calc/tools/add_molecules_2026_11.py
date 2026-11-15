"""Добавление веществ из списков аптеки (картинка, «Общий список 23.12.2025») в data/molecules.json.

Запуск (нужен RDKit):  python tools/add_molecules_2026_11.py
Структуры и дескрипторы — RDKit; физико-химия, устойчивость, теги — по справочникам
(PubChem, Handbook of Pharmaceutical Excipients, Natural Medicines). pH 1% раствора (p1)
досчитывается отдельно движком (tools/calc_p1.js), т. к. модель pH — в src/core.js.
Скрипт идемпотентен: существующие id перезаписываются.
"""
import json, re, sys, copy
from pathlib import Path
from rdkit import Chem
from rdkit.Chem import Descriptors, Crippen, rdMolDescriptors, Lipinski
from rdkit.Chem.Draw import rdMolDraw2D
from rdkit.Chem import rdDepictor

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'data' / 'molecules.json'

ALERTS = {
    'catechol': 'c(O)c[OH]', 'amine1': '[NX3;H2;!$(NC=O);!$(N-a)][CX4]', 'amine2': '[NX3;H1;!$(NC=O);!$(N-a)]([CX4])[CX4]',
    'aldehyde': '[CX3H1](=O)[#6]', 'ester': '[#6][CX3](=O)O[#6;!$(C=O)]', 'lactone': '[#6;R][CX3;R](=O)[O;R]',
    'phosphate': 'P(=O)(O)O', 'glycoside': '[OX2;R]C([OX2;R0][#6])', 'michael': 'C=CC=O', 'quat': '[NX4+]',
    'thiol': '[SX2H]', 'disulfide': 'SS', 'indole': 'c1ccc2[nH]ccc2c1', 'polyene': 'C=CC=CC=C',
}
ALERTS = {k: Chem.MolFromSmarts(v) for k, v in ALERTS.items()}


def svg_of(mol):
    m = Chem.Mol(mol)
    rdDepictor.Compute2DCoords(m)
    d = rdMolDraw2D.MolDraw2DSVG(300, 210, -1, -1, True)  # noFreetype → текст как <text>
    o = d.drawOptions(); o.clearBackground = False; o.bondLineWidth = 2; o.addStereoAnnotation = False
    d.DrawMolecule(m); d.FinishDrawing()
    s = d.GetDrawingText()
    s = re.sub(r"<\?xml[^>]*>\s*", '', s)
    s = re.sub(r"<!-- END OF HEADER -->", '', s)
    s = re.sub(r"<rect[^>]*/>", '', s)
    # чёрный → цвет текста (currentColor), классы и лишние стили — убрать
    s = s.replace('#000000', 'currentColor')
    s = re.sub(r" class='[^']*'", '', s)
    def fix_path(mm):
        tag = mm.group(0)
        st = re.search(r"style='([^']*)'", tag)
        if not st: return tag
        style = st.group(1)
        fill = re.search(r'fill:([^;]+)', style)
        stroke = re.search(r'stroke:([^;]+)', style)
        if fill and fill.group(1) not in ('none',):
            return tag  # клинья — оставить заливку
        new = re.sub(r" style='[^']*'", '', tag)
        if stroke and stroke.group(1) not in ('currentColor',):
            new = new.replace('<path ', f"<path stroke='{stroke.group(1)}' ", 1)
        return new
    s = re.sub(r"<path [^>]*/>", fix_path, s)
    def fix_text(mm):
        tag = mm.group(0)
        fill = re.search(r'fill:([^;\']+)', tag)
        tag = re.sub(r" style='[^']*'", '', tag)
        return tag[:-1] + (f" fill='{fill.group(1)}'>" if fill else " fill='currentColor'>")
    s = re.sub(r"<text [^>]*>", fix_text, s)
    s = re.sub(r" (width|height)='[^']*'", '', s, count=2)
    s = re.sub(r"\s+", ' ', s).replace('> <', '><').strip()
    return s


def desc(smi):
    mol = Chem.MolFromSmiles(smi)
    if mol is None:
        raise ValueError('SMILES: ' + smi)
    alerts = [k for k, p in ALERTS.items() if mol.HasSubstructMatch(p)]
    chir = len(Chem.FindMolChiralCenters(mol, includeUnassigned=True, useLegacyImplementation=False))
    ez = sum(1 for b in mol.GetBonds() if b.GetStereo() != Chem.BondStereo.STEREONONE)
    return dict(
        fx=rdMolDescriptors.CalcMolFormula(mol), mw_smi=round(Descriptors.MolWt(mol), 2), ex=round(Descriptors.ExactMolWt(mol), 4),
        clogp=round(Crippen.MolLogP(mol), 2), tpsa=round(rdMolDescriptors.CalcTPSA(mol), 1), hbd=Lipinski.NumHDonors(mol), hba=Lipinski.NumHAcceptors(mol),
        rotb=rdMolDescriptors.CalcNumRotatableBonds(mol), arom=rdMolDescriptors.CalcNumAromaticRings(mol), hac=mol.GetNumHeavyAtoms(),
        fsp3=round(rdMolDescriptors.CalcFractionCSP3(mol), 2), mr=round(Crippen.MolMR(mol), 1), chir=chir, ez=ez, alerts=alerts, svg=svg_of(mol))


def T(t, s, c):
    return {'t': t, 's': s, 'c': c}


def P(eff, bf='капсулы', pc=None):
    return {'bf': bf, 'pc': pc or eff, 'eff': eff}


ENZ = dict(kind='enzyme', cat='Ферменты, ЖКТ и микробиом', ab='', sp=[], sw=50, st='ox1 hy2 he3 li1 mo3', ph=[4.0, 8.0],
           taste=T('Нейтральный ферментный', 'Слабый ферментный', 'Молочный'))
MUC = dict(kind='polymer', cat='Ферменты, ЖКТ и микробиом', ab='', sp=[], st='ox0 hy0 he1 li0 mo3', ph=[3.0, 9.0])
EXT = dict(kind='extract', cat='Растительные экстракты', ab='', sp=[])

NEW = [
    # ---------- ферменты ----------
    dict(ENZ, id='protease', ru='Протеаза (грибковая)', en='Protease', tags='enzyme protein protease', dose='25-150',
         clin='Кислая/нейтральная протеаза Aspergillus: расщепляет белки пищи; в одной жидкой форме — пептиды и другие ферменты.',
         pharm=P('улучшает переваривание белков', pc='ЖКТ / ферменты'), syn='Protease; протеолитический фермент'),
    dict(ENZ, id='xylanase', ru='Ксиланаза', en='Xylanase', tags='enzyme protein', dose='10-50',
         pharm=P('помогает переваривать растительную клетчатку', pc='ЖКТ / ферменты')),
    dict(ENZ, id='agal', ru='Альфа-галактозидаза', en='Alpha-galactosidase', tags='enzyme protein', dose='50-300',
         clin='Расщепляет олигосахариды бобовых и крестоцветных (раффиноза, стахиоза) — меньше газообразования. При галактоземии — осторожно.',
         pharm=P('уменьшает газообразование от бобовых', pc='ЖКТ / ферменты')),
    dict(ENZ, id='invertase', ru='Инвертаза (сахараза)', en='Invertase (Sucrase)', tags='enzyme protein', dose='10-50',
         clin='Расщепляет сахарозу на глюкозу и фруктозу (при дефиците сахаразы-изомальтазы).',
         pharm=P('расщепляет сахарозу', pc='ЖКТ / ферменты')),
    dict(ENZ, id='glucoamylase', ru='Глюкоамилаза', en='Glucoamylase', tags='enzyme protein', dose='20-100',
         pharm=P('улучшает переваривание крахмала', pc='ЖКТ / ферменты')),
    dict(ENZ, id='hemicellulase', ru='Гемицеллюлаза', en='Hemicellulase', tags='enzyme protein', dose='10-50',
         pharm=P('помогает переваривать клетчатку', pc='ЖКТ / ферменты')),
    dict(ENZ, id='serrapeptase', ru='Серрапептаза', en='Serrapeptase', tags='enzyme protein protease antiplatelet_mild acidlabile', dose='10-60', ph=[5.0, 9.0],
         deg='Разрушается желудочной кислотой — нужна кишечнорастворимая оболочка.',
         clin='Протеаза Serratia: противоотёчное действие; может усиливать кровоточивость с антикоагулянтами. Доказательная база ограничена.',
         pharm=P('уменьшает отёк и воспаление', pc='противовоспалительное')),
    # ---------- слизистые и ЖКТ ----------
    dict(MUC, id='aloe', ru='Алоэ вера (лиофилизированный гель)', en='Aloe vera gel powder', tags='fibre hypogly_mild', dose='100-500', st='ox1 hy1 he2 li1 mo3', ph=[3.5, 7.5],
         marker='Ацеманнан (полисахариды геля); алоин (антрахиноны) в очищенном геле < 10 ppm.',
         clin='Гель (не латекс) — обволакивающее и ранозаживляющее действие. Латекс с алоином — слабительный, длительно не применять.',
         taste=T('Слабогорьковатый', 'Слабый растительный', 'Белый'), pharm=P('заживляет слизистую ЖКТ', pc='ЖКТ'), syn='Aloe vera; ацеманнан'),
    dict(MUC, id='slipelm', ru='Скользкий вяз (экстракт коры)', en='Slippery elm extract', tags='fibre gelling binder', dose='400-1600',
         marker='Слизи (полисахариды внутренней коры Ulmus rubra).', clin='Обволакивает слизистую. Снижает всасывание лекарств — разносить на 2 ч.',
         taste=T('Нейтральный слизистый', 'Слабый древесный', 'Светло-коричневый'), pharm=P('обволакивает и защищает слизистую ЖКТ', pc='ЖКТ'), syn='Ulmus rubra'),
    dict(MUC, id='marshmallow', ru='Алтей лекарственный (экстракт корня)', en='Marshmallow root extract', tags='fibre gelling binder hypogly_mild', dose='500-2000',
         marker='Слизи (арабиногалактаны, рамногалактуронаны) корня Althaea officinalis.', clin='Обволакивающее действие. Снижает всасывание лекарств — разносить на 2 ч.',
         taste=T('Сладковатый слизистый', 'Слабый растительный', 'Светло-бежевый'), pharm=P('обволакивает и смягчает слизистую', pc='ЖКТ'), syn='Althaea officinalis; алтей'),
    dict(MUC, id='okra', ru='Бамия (экстракт)', en='Okra extract', tags='fibre gelling hypogly_mild', dose='250-1000',
         marker='Полисахаридные слизи Abelmoschus esculentus.', clin='Слизи замедляют всасывание глюкозы; снижает всасывание метформина (данные на животных).',
         taste=T('Нейтральный слизистый', 'Слабый растительный', 'Зеленовато-бежевый'), pharm=P('обволакивает слизистую, мягко снижает сахар', pc='ЖКТ / метаболизм'), syn='Окра; Abelmoschus'),
    dict(MUC, id='plantain', ru='Подорожник большой (экстракт листа)', en='Plantain leaf extract', tags='fibre', dose='200-1000', kind='extract', st='ox1 hy1 he1 li1 mo2',
         marker='Иридоиды (аукубин), слизи, флавоноиды Plantago major.', clin='Противовоспалительное и обволакивающее. Не путать с псиллиумом (Plantago ovata).',
         taste=T('Горьковато-травяной', 'Травяной', 'Зелёно-коричневый'), pharm=P('снимает воспаление слизистой', pc='ЖКТ'), syn='Plantago major'),
    dict(EXT, id='calendula', ru='Календула (экстракт)', en='Calendula extract', tags='colored', dose='100-500', st='ox1 hy1 he1 li2 mo1', ph=[3.0, 8.0],
         marker='Тритерпеновые эфиры фарадиола, каротиноиды, флавоноиды.', clin='Ранозаживляющее и противовоспалительное; чаще наружно. Аллергия на сложноцветные.',
         taste=T('Горьковатый', 'Травяной', 'Оранжевый'), pharm=P('заживляет и снимает воспаление', 'крем', 'противовоспалительное'), syn='Calendula officinalis; ноготки'),
    dict(EXT, id='chamomile', ru='Ромашка аптечная (экстракт)', en='Chamomile extract', tags='sedative_mild antiplatelet_mild cyp3a4inh_mild', dose='300-1500', st='ox1 hy1 he2 li1 mo1', ph=[3.0, 8.0],
         marker='Апигенин 1,2%, α-бисаболол, хамазулен.', clin='Спазмолитик и мягкое седативное. Кумарины — осторожно с варфарином; аллергия на сложноцветные.',
         taste=T('Травяной сладковатый', 'Характерный ромашковый', 'Жёлто-коричневый'), pharm=P('успокаивает, снимает спазм', pc='нейро / ЖКТ'), syn='Matricaria chamomilla'),
    dict(MUC, id='arabinogalactan', ru='Арабиногалактан (лиственница)', en='Arabinogalactan', tags='fibre prebiotic immunostim', dose='1500-4500', st='ox0 hy0 he0 li0 mo1', sw=500,
         marker='Полисахарид Larix (арабиноза : галактоза ≈ 1 : 6).', clin='Пребиотик (бутират-продуцирующие бактерии); мягкий иммуномодулятор.',
         taste=T('Сладковатый нейтральный', 'Практически без запаха', 'Светло-бежевый'), pharm=P('пребиотик, поддерживает иммунитет', 'порошок', 'микробиом'), syn='Larch arabinogalactan; лиственница'),
    dict(id='nag', ru='N-ацетил-D-глюкозамин', en='N-acetyl-D-glucosamine', cat='Суставы и кожа', kind='small', smiles='CC(=O)N[C@@H]1C(O)O[C@H](CO)[C@@H](O)[C@@H]1O',
         sw=250, lp=-2.5, mp=205, st='ox0 hy1 he1 li0 mo1', ph=[3.0, 8.0], tags='redsugar', dose='500-3000', ab='', sp=[],
         clin='Субстрат синтеза гиалуроновой кислоты и муцинов кишечного барьера. Восстанавливающий сахар — реакция Майяра с аминокислотами.',
         taste=T('Сладковатый', 'Практически без запаха', 'Белый'), pharm=P('восстанавливает слизистый барьер кишечника', pc='ЖКТ / суставы'), syn='NAG; N-acetylglucosamine'),
    dict(id='butyrate', ru='Натрия бутират', en='Sodium butyrate', cat='Ферменты, ЖКТ и микробиом', kind='small', smiles='CCCC(=O)O', fs='C4H7NaO2', mw=110.09,
         sw=330, s0=60, lp=0.79, mp=251, st='ox0 hy0 he1 li0 mo3', ph=[4.0, 9.0], tags='hygro', dose='300-1200', ab='4.82;0;-1;1',
         clin='Основной источник энергии колоноцитов, укрепляет плотные контакты, ингибитор HDAC. Резкий запах — капсулы с кишечнорастворимой оболочкой.',
         taste=T('Солоноватый', 'Резкий прогорклый (масляный)', 'Белый'), pharm=P('питает клетки кишечника и укрепляет барьер', pc='ЖКТ'), syn='Бутират; масляная кислота; butyric acid'),
    # ---------- минералы и витамины ----------
    dict(id='febis', ru='Железа бисглицинат (хелат)', en='Ferrous bisglycinate', cat='Минералы', kind='mineral', fx='C4H8FeN2O4', mw=203.96, mw_smi=203.96,
         sw=30, st='ox2 hy0 he0 li0 mo1', ph=[3.0, 8.0], tags='Fe polyval redoxmetal oxidant colored', dose='50-150', elem={'Fe': 0.2738}, ab='2.34,9.6;1;-1;2|9.5;2;2;1',
         deg='Хелат устойчивее солей, но Fe²⁺ всё же окисляется во влаге и катализирует окисление витаминов.',
         clin='Лучше переносится, чем сульфат и фумарат; меньше зависит от фитатов. Кальций и полифенолы снижают всасывание; витамин C повышает.',
         taste=T('Металлический', 'Практически без запаха', 'Серо-зелёный'), pharm=P('повышает железо без раздражения ЖКТ', pc='минералы'), syn='Iron bisglycinate; железо хелат; Ferrochel', alerts=['amine1'], chir=0, ez=0),
    dict(id='mgthr', ru='Магния L-треонат', en='Magnesium L-threonate', cat='Минералы', kind='mineral', smiles='OC[C@@H](O)[C@H](O)C(=O)O', fs='C8H14MgO10', mw=294.49,
         sw=50, st='ox0 hy0 he0 li0 mo1', ph=[4.0, 9.0], tags='Mg polyval electrolyte', dose='1000-2000', elem={'Mg': 0.0825}, ab='3.6;0;-1;2',
         clin='Форма магния с наилучшим проникновением в мозг (данные на животных); 2 г соли ≈ 144 мг элементного Mg.',
         taste=T('Солоноватый', 'Практически без запаха', 'Белый'), pharm=P('поддерживает память и сон', pc='минералы / нейро'), syn='Magtein; треонат магния'),
    dict(id='b2', ru='Витамин B2 (рибофлавин-5′-фосфат натрия)', en='Riboflavin sodium phosphate', cat='Витамины', kind='small',
         smiles='Cc1cc2nc3c(=O)[nH]c(=O)nc-3n(C[C@H](O)[C@H](O)[C@H](O)COP(=O)(O)O)c2cc1C', fs='C17H20N4NaO9P', mw=478.33,
         sw=50, lp=-2.5, mp=290, st='ox1 hy1 he1 li3 mo2', ph=[5.0, 7.0], tags='b2 photosens colored baselabile', dose='5-100', ab='1.9,6.1,10.2;0;-1.6;1',
         deg='На свету быстро разрушается до люмифлавина/люмихрома; неустойчив в щелочной среде. Фотосенсибилизатор: на свету ускоряет окисление витамина C, фолатов, B12.',
         salt='Коммерческая субстанция — смесь моно- и динатриевой соли (USP: pH 1% раствора 5,0–6,5).', clin='Активная форма (FMN) — кофактор MTHFR, PNPO (активация B6), дыхательной цепи. 400 мг рибофлавина — профилактика мигрени. Окрашивает мочу в жёлтый.',
         taste=T('Горьковатый', 'Слабый характерный', 'Оранжево-жёлтый'), pharm=P('участвует в энергетическом обмене', pc='витамин'), syn='Рибофлавин; Riboflavin; FMN; B2'),
    # ---------- метаболизм ----------
    dict(id='succinic', ru='Янтарная кислота', en='Succinic acid', cat='Метаболизм и вес', kind='small', smiles='OC(=O)CCC(=O)O',
         sw=83, s0=83, lp=-0.59, mp=185, st='ox0 hy0 he0 li0 mo0', ph=[2.0, 10.0], tags='', dose='100-500', ab='4.21,5.64;0;0;1',
         clin='Субстрат комплекса II (сукцинатдегидрогеназа). Подкисляет рецептуру; раздражает слизистую желудка натощак.',
         taste=T('Кислый', 'Практически без запаха', 'Белый'), pharm=P('поддерживает энергетику клеток', 'напитки', 'энергия / митохондрии'), syn='Succinate; сукцинат'),
    dict(EXT, id='garcinia', ru='Гарциния камбоджийская (ГЛК)', en='Garcinia cambogia extract', cat='Метаболизм и вес', smiles=None, tags='hepatox_rare', dose='500-1500', st='ox0 hy1 he1 li0 mo2', ph=[3.0, 8.0],
         marker='Гидроксилимонная кислота (ГЛК) 50–60% (соли Ca/K). В кислой среде лактонизируется.',
         clin='Снижает аппетит (ингибитор АТФ-цитратлиазы). Описаны случаи гепатотоксичности; серотонинергический синдром с СИОЗС (единичные случаи).',
         taste=T('Кисловато-горький', 'Слабый фруктовый', 'Бежевый'), pharm=P('снижает аппетит', pc='метаболизм / вес'), syn='Garcinia; HCA; гидроксицитрат'),
    dict(EXT, id='garlic', ru='Чеснок (экстракт)', en='Garlic extract', cat='Растительные экстракты', tags='antiplatelet hypotens_mild hypogly_mild sulfurodor electrophile', dose='300-1200', st='ox2 hy2 he3 li1 mo2', ph=[4.5, 7.0],
         marker='Аллицин / S-аллилцистеин (выдержанный экстракт).', deg='Аллицин нестабилен: разрушается при нагреве и в растворе за часы–дни; выдержанный экстракт (S-аллилцистеин) стабильнее.',
         clin='Антиагрегант, снижает давление и холестерин. Усиливает антикоагулянты; индуцирует CYP3A4/P-gp (снижает уровень саквинавира).',
         taste=T('Острый', 'Резкий чесночный', 'Бежевый'), pharm=P('поддерживает сосуды и давление', pc='сосуды'), syn='Allium sativum; аллицин'),
    # ---------- растения ----------
    dict(EXT, id='horsechest', ru='Конский каштан (эсцин)', en='Horse chestnut extract (aescin)', tags='antiplatelet_mild saponin bitter baselabile', dose='250-600', st='ox1 hy2 he1 li1 mo1', ph=[4.0, 7.0],
         marker='Эсцин 16–20% (тритерпеновые сапонины).', clin='Венотоник: снижает проницаемость капилляров и отёки. Осторожно с антикоагулянтами; при ХБП (нефротоксичность в высоких дозах). Сырые семена токсичны.',
         taste=T('Горький', 'Слабый растительный', 'Светло-коричневый'), pharm=P('укрепляет вены, снимает отёки', pc='сосуды'), syn='Aesculus hippocastanum; эсцин; aescin'),
    dict(EXT, id='celandine', ru='Чистотел (экстракт)', en='Celandine extract', tags='hepatox alkaloid bitter colored', dose='100-300', st='ox2 hy1 he1 li2 mo1', ph=[3.0, 7.0],
         marker='Алкалоиды: хелидонин, сангвинарин, хелеритрин, берберин.',
         clin='Желчегонное и спазмолитическое. Внутрь — описаны тяжёлые лекарственные гепатиты (EMA): не применять при заболеваниях печени, беременности, курсами > 4 недель.',
         taste=T('Очень горький', 'Неприятный', 'Жёлто-оранжевый'), pharm=P('желчегонное и спазмолитическое (традиционно)', pc='печень'), syn='Chelidonium majus'),
    dict(id='aucubin', ru='Аукубин', en='Aucubin', cat='Растительные экстракты', kind='small',
         smiles='OC[C@H]1O[C@@H](O[C@@H]2OC=C[C@@H]3[C@H]2C(CO)=C[C@@H]3O)[C@H](O)[C@@H](O)[C@@H]1O',
         sw=100, lp=-2.0, mp=181, st='ox1 hy2 he2 li1 mo1', ph=[5.0, 8.0], tags='acidlabile', dose='10-100', ab='', sp=[],
         deg='В кислой среде и под действием β-глюкозидаз гидролизуется до агликона, который полимеризуется (потемнение).',
         clin='Иридоид подорожника и элеутерококка: гепатопротекторное и противовоспалительное действие (в основном доклинические данные).',
         taste=T('Горьковатый', 'Практически без запаха', 'Белый'), pharm=P('защищает печень, противовоспалительное', pc='печень')),
    dict(EXT, id='saffron', ru='Шафран (экстракт, сафраналь)', en='Saffron extract', tags='colored stain sedative_mild', dose='20-30', st='ox2 hy1 he2 li3 mo2', ph=[4.0, 7.0],
         marker='Кроцин, сафраналь (≥ 2%), пикрокроцин.', deg='Кроцин и сафраналь разрушаются светом и при нагреве.',
         clin='Антидепрессивное действие сопоставимо с низкими дозами СИОЗС в РКИ; с СИОЗС — осторожно. В дозах > 5 г — утеротоническое (противопоказан при беременности).',
         taste=T('Горьковато-медовый', 'Пряный', 'Красно-оранжевый'), pharm=P('улучшает настроение', pc='нейро'), syn='Crocus sativus; кроцин; сафраналь; affron'),
    dict(EXT, id='cornflower', ru='Василёк синий', en='Cornflower', tags='anthocyanin colored', dose='', st='ox2 hy1 he2 li2 mo1', ph=[2.5, 6.0],
         marker='Антоцианы (цианин), флавоноиды.', clin='Мягкое противовоспалительное и мочегонное (традиционно), примочки для глаз. Доказательная база ограничена.',
         taste=T('Горьковатый', 'Слабый травяной', 'Синий'), pharm=P('противовоспалительное (традиционно)', pc='растительное'), syn='Centaurea cyanus'),
    dict(id='sflecithin', ru='Лецитин подсолнечный (фосфатидилхолин)', en='Sunflower lecithin', cat='Мембраны и печень', kind='extract', ab='', sp=[], oil=2, eth=1,
         st='ox2 hy2 he1 li1 mo1', ph=[5.0, 8.0], tags='lipid emulsifier surfactant chol oxprone', dose='1000-5000',
         marker='Фосфатидилхолин 20–90% (в зависимости от фракции).', clin='Источник холина и фосфолипидов; эмульгатор — повышает всасывание жирорастворимых веществ. Без сои (аллерген-фри).',
         taste=T('Маслянистый', 'Слабый ореховый', 'Светло-жёлтый'), pharm=P('источник фосфатидилхолина', pc='мембраны / печень'), syn='Lecithin; фосфатидилхолин; PC'),
    # ---------- пептиды ----------
    dict(id='bpc157', ru='BPC-157', en='BPC-157', cat='Пептиды', kind='peptide', seq='GEPPPGKPADDAGLV', fx='C62H98N16O22', mw=1419.5, mw_smi=1419.5,
         sw=100, st='ox1 hy2 he2 li1 mo2', ph=[4.0, 7.0], tags='peptide', ab='', sp=[], pep={'nterm': 1, 'cterm': 1, 'K': 1, 'D': 2, 'E': 1},
         clin='Пентадекапептид из белка желудочного сока: в доклинике ускоряет заживление слизистых, сухожилий, мышц. Клинических данных мало; стимулирует ангиогенез — осторожно при опухолях. Запрещён WADA.',
         taste=T('Нейтральный', 'Практически без запаха', 'Белый'), pharm=P('регенерация тканей и слизистых', 'сублингвал / капсулы', 'пептиды'), syn='Body Protection Compound; Би-Пи-Си'),
]

# ---------- липосомальные формы: копии базовых веществ ----------
LIPO = [('resv_lipo', 'resv', 'Ресвератрол липосомальный', 'Liposomal resveratrol', '100-500'),
        ('curc_lipo', 'curcumin', 'Куркумин липосомальный', 'Liposomal curcumin', '100-500'),
        ('astax_lipo', 'astax', 'Астаксантин липосомальный', 'Liposomal astaxanthin', '4-12'),
        ('sily_lipo', 'silymarin', 'Силимарин липосомальный', 'Liposomal silymarin', '140-420')]
LIPO_NOTE = ('Готовая липосомальная система (фосфолипидные везикулы): вещество диспергируется в воде, биодоступность выше. '
             'Липосомы разрушаются этанолом > 10%, ПАВ, высокой концентрацией электролитов, замораживанием и нагревом > 40 °C.')


# синонимы существующих веществ (названия из списков аптеки) — для поиска
SYN = {
    'htp': 'Гриффония; Griffonia; Oxitriptan', 'astax': 'Гематококк; Haematococcus', 'pomegranate': 'Пуникалагин; Punicalagin; уролитин; кожура граната',
    'sterols': 'Бета-ситостерол; Beta-sitosterol; Фитостеролы; Phytosterols; древесные стеролы',
    'silymarin': 'Силибинин; Silibinin; расторопша', 'curcumin': 'Куркума; Turmeric', 'pycno': 'Пикногенол; Pine bark OPC; кора сосны',
    'tulsi': 'Holy basil; базилик священный', 'eleuthero': 'Элеутерозиды; Eleutherosides; элеутерококк', 'bittermelon': 'Momordica; момордика; горькая дыня',
    'gsh_lipo': 'Нано-глутатион; Nano glutathione', 'betaglucan': 'Yeast beta-glucan; дрожжевой бета-глюкан', 'segly': 'Селен; Selenium',
    'semet': 'Селен; Selenium', 'citrus': 'Витамин P; Vitamin P; биофлавоноиды; Bioflavonoids', 'dhq': 'Таксифолин; Taxifolin; лиственница',
    'phospholip': 'Эссенциале; Essential phospholipids', 'c60': 'Fullerene; фуллерен', 'testo': 'Биоидентичный тестостерон', 'prog': 'Биоидентичный прогестерон',
    'dhea': 'Биоидентичный ДГЭА', 'preg': 'Биоидентичный прегненолон', 'gymnema': 'Gymnema sylvestre; Сильвестр; Gymnema silvester', 'dha': 'Омега-3; Omega-3; DHA; ДНА',
    'ashwagandha': 'KSM-66; витания', 'bacopa': 'Brahmi; брахми; Bacopa monnieri; монньери', 'cape': 'кофеиновый эфир; CAPE', 'retinol': 'Витамин A; Vitamin A',
    'same': 'S-аденозилметионин; SAMe; дисульфат тозилат', 'nmn': 'β-NMN; бета-НМН', 'pqq': 'пирролохинолинхинон; PQQ', 'mthf': 'метилфолат; B9; Vitamin B9',
    'mecbl': 'B12; Vitamin B12', 'cncbl': 'B12', 'thiamine': 'B1; Vitamin B1', 'benfo': 'B1', 'biotin': 'B7; Vitamin B7', 'nam': 'B3; Vitamin B3; ниацинамид',
    'niacin': 'B3', 'pantoth': 'B5', 'pyridox': 'B6', 'p5p': 'B6', 'folic': 'B9', 'dci': 'Inositol D-chiro; Д-хиро', 'mgcit': 'безводный цитрат магния',
    'crpic': 'Chromium picolinate', 'znbis': 'Zinc bisglycinate', 'akkermansia': 'лиофилизат; муцинифила', 'glucosamine': 'Glucosamine sulfate 2KCl',
    'akg': 'Альфа-кетоглутарат; AKG', 'amp': 'Аденозинмонофосфат; AMP', 'dim': 'Дииндолилметан; DIM', 'nr': 'Никотинамидрибозид; NR',
    'tribulus': 'Tribulus terrestris; якорцы стелющиеся', 'anastrozole': 'Анастразол; Anastrazole', 'gaba': 'Гамма-аминомасляная кислота; GABA',
    'schisandra': 'Схизандрин; Schisandrin; китайский лимонник; лимончик', 'psyllium': 'Psyllium husk; шелуха подорожника', 'mgtaur': 'Тауринат магния; Magnesium taurinate',
    'ergo': 'Ergothioneine', 'vitk2': 'MK-7; менахинон', 'vitd3': 'холекальциферол; D3', 'vite': 'токоферол', 'mucuna': 'L-DOPA растительный',
}


def main():
    db = json.loads(DB.read_text(encoding='utf-8'))
    by = {m['id']: m for m in db}
    out = []
    for e in NEW:
        e = copy.deepcopy(e)
        smi = e.pop('smiles', None)
        if smi:
            d = desc(smi)
            for k, v in d.items():
                if k == 'alerts' and e.get('alerts'):
                    continue
                e.setdefault(k, v)
        e.setdefault('mw', e.get('mw_smi'))
        # кислотно-основная модель: 'pKa,pKa;zf;z0;n|...' → sp
        e['sp'] = [[[float(x) for x in part.split(';')[0].split(',')], float(part.split(';')[1]), float(part.split(';')[2]), float(part.split(';')[3])]
                   for part in (e.get('ab') or '').split('|') if part]
        out.append(e)
    for nid, base, ru, en, dose in LIPO:
        b = copy.deepcopy(by[base])
        for k in ('pharm', 's0', 'sp', 'ab', 'p1', 'poly', 'salt', 'iso'):
            b.pop(k, None)
        tags = [t for t in b.get('tags', '').split() if t not in ('lipo', 'baselabile')]
        b.update(id=nid, base=base, ru=ru, en=en, kind='formulation', dose=dose, sw=50, ab='', sp=[], ph=[4.0, 7.5],
                 tags=' '.join(tags + ['liposome']), clin=LIPO_NOTE + (' ' + by[base]['clin'] if by[base].get('clin') else ''),
                 pharm={'bf': 'жидкость', 'pc': (by[base].get('pharm') or {}).get('pc', ''), 'eff': (by[base].get('pharm') or {}).get('eff', '') + ' (липосомальная форма)'},
                 syn='липосомальный ' + by[base]['ru'].split(' ')[0].lower() + '; liposomal ' + by[base]['en'].split(' ')[0].lower())
        out.append(b)
    for k, base in (('vitc_lipo', 'vitc'), ('gsh_lipo', 'gsh'), ('curc_mic', 'curcumin')):
        if k in by:
            by[k]['base'] = base
    for k, v in SYN.items():
        if k in by:
            by[k]['syn'] = v
    ids = {e['id'] for e in out}
    db = [m for m in db if m['id'] not in ids] + out
    DB.write_text(json.dumps(db, ensure_ascii=False, indent=None, separators=(',', ':')), encoding='utf-8')
    print('добавлено/обновлено:', len(out), 'всего:', len(db))


if __name__ == '__main__':
    main()
