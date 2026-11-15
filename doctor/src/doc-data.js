/* ===== Врачебная версия: направленность, время приёма, противопоказания ===== */
'use strict';

/* ---------- Направленность ---------- */
const DIRS = {
  energy:  { n: 'Энергия и митохондрии', ids: 'nad nadh nadp nmn nmnh nr nam amp akg coq10 pqq ala alcar lcar cabhb thiamine benfo pantoth b15 motsc shilajit ginseng eleuthero rhodiola schisandra yerba asp ipamorelin b2 succinic' },
  neuro:   { n: 'Мозг, память, внимание', ids: 'agpc citicoline uridine ump dha lionsmane bacopa ginkgo semax tyr ldopa mucuna alcar pqq mecbl cncbl benfo carnosine luteolin preg mgthr saffron sflecithin' },
  sleep:   { n: 'Сон, стресс, настроение', ids: 'melatonin gaba theanine glycine htp same selank dsip apigenin hops ashwagandha tulsi rhodiola mgbis mgtaur mgcit taurine cherry inositol prog oxytocin chamomile mgthr saffron' },
  vessels: { n: 'Сосуды, кровоток, NO', ids: 'arg cit citmal tadalafil pycno grapeseed ginkgo nattokinase diosmin citrus epimedium niacin horsechest garlic' },
  heart:   { n: 'Сердце и липиды', ids: 'coq10 dha sterols berberine niacin oryzanol taurine mgorot mgtaur vitk2 artichoke resv htyr oleuropein pomegranate lycopene betaglucan psyllium lcar garlic sflecithin' },
  glucose: { n: 'Углеводный обмен и вес', ids: 'metformin sitagliptin semaglutide tirzepatide berberine bittermelon gymnema galega cinnamon opuntia mangiferin cga inositol dci crpic ala fenugreek yerba synephrine fucox keto7 cabhb akkermansia pterost motsc garcinia okra aloe' },
  antiox:  { n: 'Антиоксиданты и антиэйдж', ids: 'gsh sag gsh_lipo nac ergo astax htyr ferulic c60 quercetin fisetin egcg dhq curcumin curc_mic thc pterost resv polygonum vitc vitc_lipo vite sod catalase gpx myricetin rosemary pomegranate roxpear carnosine trehalose spermidine epitalon phycocyanin sulforaphane nmn lycopene resv_lipo curc_lipo astax_lipo cornflower' },
  inflam:  { n: 'Противовоспалительное', ids: 'curcumin curc_mic boswellia pea dha quercetin luteolin bromelain ginger andrographolide cape apigenin ursolic oleanolic phycocyanin spirulina cherry catsclaw serrapeptase calendula chamomile plantain aucubin bpc157 curc_lipo' },
  liver:   { n: 'Печень, желчь, детокс', ids: 'silymarin phospholip nac gsh sag gsh_lipo tudca udca artichoke dandelion sulforaphane tmg schisandra glycyrrhizin orn gardenia same celandine aucubin sflecithin sily_lipo' },
  gut:     { n: 'ЖКТ и микробиом', ids: 'pancrelipase amylase lactase cellulase maltdiast phytase papain bromelain akkermansia inulin psyllium fig flax betainehcl gentian ginger tannins lionsmane glycyrrhizin protease xylanase agal invertase glucoamylase hemicellulase aloe slipelm marshmallow okra plantain chamomile calendula arabinogalactan nag butyrate bpc157' },
  immune:  { n: 'Иммунитет', ids: 'vitc vitc_lipo vitd3 znbis znpic zngluc segly semet betaglucan astragalus catsclaw andrographolide spirulina lys retinol arabinogalactan garlic' },
  joints:  { n: 'Суставы, кости, кожа', ids: 'glucosamine chondroitin hyaluronate boswellia cacit camal vitd3 vitk2 boron pea biotin astax same ipamorelin bpc157 nag serrapeptase' },
  male:    { n: 'Мужское здоровье', ids: 'testo dhea daa tongkat fadogia tribulus fenugreek safedmusli damiana epimedium sawpalm pygeum pumpkin nettle chrysin anastrozole tadalafil pt141 boron znpic' },
  female:  { n: 'Женское здоровье', ids: 'e2 e3 prog redclover soy genistein formononetin hops dim i3c inositol dci flax cagluc diosgenin pt141 dhea' },
  thyroid: { n: 'Щитовидная железа', ids: 'ki segly semet tyr ashwagandha' },
  blood:   { n: 'Кроветворение и метилирование', ids: 'fefum mecbl cncbl mthf folic pyridox p5p tmg same cubis febis b2' },
  eyes:    { n: 'Зрение', ids: 'lutein astax dha retinol cornflower astax_lipo b2' }
};
const DIR_OF = {};
for (const k in DIRS) DIRS[k].ids.split(/\s+/).forEach(id => { (DIR_OF[id] = DIR_OF[id] || []).push(k); });
// липосомальные и мицеллярные формы — направленность исходного вещества
DB.forEach(m => { if (m.base && !DIR_OF[m.id] && DIR_OF[m.base]) DIR_OF[m.id] = DIR_OF[m.base].slice(); });
const BIOENH = new Set(['piperine']);

/* ---------- Время приёма ---------- */
function timing(m) {
  const T = m.T, id = m.base || m.id;
  let slot = 'any', food = null;
  const morning = T.has('stimulant') || T.has('sympath') || T.has('caffeine') || T.has('thermogenic') || T.has('stimulant_mild') ||
    ['tyr', 'nmn', 'nr', 'nad', 'nadh', 'nmnh', 'alcar', 'dhea', 'preg', 'testo', 'mecbl', 'cncbl', 'pqq', 'semax', 'keto7', 'b15', 'succinic', 'b2', 'garcinia'].includes(id);
  const evening = T.has('sedative') || T.has('hormone_sleep') || T.has('sedative_mild') || ['mgbis', 'mgtaur', 'mgcit', 'mgthr', 'prog', 'ashwagandha', 'dsip', 'cherry', 'chamomile', 'saffron'].includes(id);
  if (evening && !T.has('stimulant')) slot = 'evening'; else if (morning) slot = 'morning';
  if (T.has('ldopa') || ['htp', 'tyr', 'synephrine', 'akkermansia', 'nmn', 'nr'].includes(id)) food = 'empty';
  if (T.has('lipo') || T.has('fatvit') || T.has('carotenoid') || ['coq10', 'curcumin', 'dha', 'sterols', 'berberine', 'metformin', 'betainehcl', 'cinnamon', 'crpic', 'pea', 'boswellia', 'curc_mic'].includes(id) ||
      (m.kind === 'enzyme' && !['nattokinase', 'bromelain', 'serrapeptase', 'sod', 'catalase', 'gpx'].includes(id)) || ['b2', 'sflecithin', 'garlic', 'succinic'].includes(id)) food = 'food';
  if (['slipelm', 'marshmallow', 'aloe', 'okra', 'garcinia', 'bpc157'].includes(id)) food = 'empty';
  if (id === 'fefum') food = 'empty';
  if (['nattokinase', 'bromelain', 'serrapeptase', 'febis'].includes(id)) food = 'empty';
  return { slot, food };
}
const SLOT_N = { morning: 'Утро', evening: 'Вечер', any: 'Любое время' };
const FOOD_N = { empty: 'натощак', food: 'во время еды' };

/* ---------- Состояния пациента ---------- */
const CONDITIONS = [
  { k: 'preg', n: 'Беременность, лактация' },
  { k: 'anticoag', n: 'Антикоагулянты / антиагреганты, кровоточивость, операция' },
  { k: 'diab', n: 'Сахароснижающая терапия' },
  { k: 'htn', n: 'Артериальная гипертензия' },
  { k: 'hypot', n: 'Гипотензия' },
  { k: 'nitrates', n: 'Нитраты' },
  { k: 'cardio', n: 'Аритмии, ИБС' },
  { k: 'ssri', n: 'Антидепрессанты (СИОЗС, ИМАО), триптаны' },
  { k: 'psych', n: 'Биполярное расстройство, психоз' },
  { k: 'hormcancer', n: 'Гормонозависимые опухоли (в т. ч. в анамнезе)' },
  { k: 'thyroid', n: 'Заболевания щитовидной железы, левотироксин' },
  { k: 'liver', n: 'Заболевания печени' },
  { k: 'kidney', n: 'Хроническая болезнь почек, камни' },
  { k: 'autoimmune', n: 'Аутоиммунные заболевания, иммуносупрессоры' },
  { k: 'ironover', n: 'Перегрузка железом, гемохроматоз' },
  { k: 'ulcer', n: 'Язвенная болезнь, гастрит' },
  { k: 'gout', n: 'Подагра, гиперурикемия' }
];
const COND_N = Object.fromEntries(CONDITIONS.map(c => [c.k, c.n]));

/* ---------- Противопоказания и предостережения ----------
 * sev: 3 — противопоказано, 2 — с осторожностью, 1 — учесть.
 * sel: тег, 'id:...' или функция; t — пояснение для врача. */
const PREG_OK = new Set('febis mgthr b2 folic mthf mecbl cncbl pyridox p5p vitd3 vitc ki fefum cacit camal mgcit mgbis mgtaur mgorot znbis znpic zngluc dha inositol glycine lactase pancrelipase psyllium inulin choline'.split(' '));
const CONTRA = [
  // беременность
  { c: 'preg', sev: 3, sel: m => m.T.has('hormone') || m.T.has('androgen') || m.T.has('estrogen') || m.T.has('progestogen') || m.T.has('ai') || m.T.has('antiestro') || m.T.has('estrogenprec'), t: 'Гормональный препарат: при беременности и лактации не назначается вне показаний специалиста.' },
  { c: 'preg', sev: 3, sel: ['teratogen'], t: 'Ретинол в высоких дозах тератогенен.' },
  { c: 'preg', sev: 3, sel: ['glp1', 'dpp4', 'id:galega', 'id:berberine'], t: 'Противопоказан при беременности и лактации (для берберина — риск ядерной желтухи у новорождённого).' },
  { c: 'preg', sev: 3, sel: ['mineralocort', 'id:ashwagandha', 'id:andrographolide', 'id:fenugreek', 'id:tribulus', 'id:tongkat', 'id:fadogia', 'id:mucuna', 'id:ldopa', 'sympath', 'phytoestrogen', 'estromet', 'id:oxytocin', 'id:pt141'], t: 'Не рекомендуется при беременности: гормональное, утеротоническое или стимулирующее действие либо нет данных о безопасности.' },
  { c: 'preg', sev: 2, sel: m => !PREG_OK.has(m.id), t: 'Данных о безопасности при беременности и лактации недостаточно.', fallback: true },
  { c: 'preg', sev: 3, sel: ['id:celandine', 'id:saffron', 'id:garcinia', 'id:bpc157', 'id:horsechest', 'id:aloe', 'id:calendula'], t: 'Не применять при беременности и лактации (гепатотоксичность, утеротоническое действие или нет данных о безопасности).' },
  // кровотечения
  { c: 'anticoag', sev: 2, sel: ['id:serrapeptase', 'id:horsechest', 'id:garlic'], t: 'Может усиливать кровоточивость с антикоагулянтами и антиагрегантами; отменить за 1–2 недели до операции.' },
  { c: 'anticoag', sev: 3, sel: ['fibrinolytic'], t: 'Фибринолитик: с антикоагулянтами и перед операцией — риск кровотечения.' },
  { c: 'anticoag', sev: 3, sel: ['vitk'], t: 'Витамин K снижает действие варфарина и других антагонистов витамина K (для НОАК не значимо).' },
  { c: 'anticoag', sev: 2, sel: ['antiplatelet'], t: 'Угнетает агрегацию тромбоцитов: усиливает действие антикоагулянтов и антиагрегантов; отменить за 7–14 дней до операции.' },
  { c: 'anticoag', sev: 2, sel: ['warfantag'], t: 'Может ослаблять действие варфарина (структурное сходство с витамином K) — контроль МНО.' },
  { c: 'anticoag', sev: 1, sel: ['antiplatelet_mild'], t: 'Слабое антиагрегантное действие.' },
  // диабет
  { c: 'diab', sev: 3, sel: m => m.T.has('rx') && (m.T.has('hypogly') || m.T.has('glp1') || m.T.has('dpp4')), t: 'Сахароснижающий препарат: возможно дублирование текущей терапии.' },
  { c: 'diab', sev: 2, sel: m => m.T.has('hypogly') && !m.T.has('rx'), t: 'Снижает глюкозу: на фоне сахароснижающей терапии — риск гипогликемии, контроль гликемии.' },
  { c: 'diab', sev: 1, sel: ['hypogly_mild'], t: 'Мягкое влияние на гликемию.' },
  // давление
  { c: 'htn', sev: 3, sel: ['sympath', 'mineralocort'], t: 'Повышает артериальное давление (симпатомиметик / задержка натрия).' },
  { c: 'htn', sev: 2, sel: ['stimulant', 'hypertens_mild', 'id:testo'], t: 'Может повышать давление или ЧСС.' },
  { c: 'hypot', sev: 2, sel: ['pde5', 'hypotens', 'vasodil'], t: 'Снижает артериальное давление.' },
  { c: 'hypot', sev: 1, sel: ['hypotens_mild'], t: 'Мягкое гипотензивное действие.' },
  { c: 'nitrates', sev: 3, sel: ['pde5'], t: 'Ингибиторы ФДЭ-5 с нитратами противопоказаны: тяжёлая гипотензия.' },
  { c: 'nitrates', sev: 2, sel: ['pde5_weak', 'no'], t: 'Усиливает вазодилатацию на фоне нитратов.' },
  { c: 'cardio', sev: 3, sel: ['sympath'], t: 'Симпатомиметик: тахикардия, аритмии.' },
  { c: 'cardio', sev: 2, sel: ['stimulant', 'caffeine', 'mineralocort', 'thyroid_up'], t: 'Может провоцировать тахикардию или гипокалиемию.' },
  { c: 'cardio', sev: 2, sel: ['pde5'], t: 'При ИБС — оценить переносимость нагрузки; исключить нитраты.' },
  // психиатрия
  { c: 'ssri', sev: 3, sel: ['serotonergic', 'serotonergic_mild'], t: 'С СИОЗС/ИМАО/триптанами — риск серотонинового синдрома.' },
  { c: 'ssri', sev: 3, sel: m => m.T.has('sympath') || m.T.has('dopaminergic'), t: 'С ИМАО — гипертензивный криз.' },
  { c: 'ssri', sev: 2, sel: ['maoi_weak', 'id:tyr'], t: 'Слабое влияние на моноамины: осторожно с ИМАО и СИОЗС.' },
  { c: 'psych', sev: 3, sel: ['serotonergic_mild', 'serotonergic'], t: 'Может провоцировать маниакальную фазу.' },
  { c: 'psych', sev: 2, sel: ['stimulant', 'sympath', 'dopaminergic', 'id:tyr', 'id:rhodiola'], t: 'Стимулирующее / дофаминергическое действие — возможна дестабилизация.' },
  { c: 'ssri', sev: 2, sel: ['id:saffron', 'id:garcinia'], t: 'Возможное усиление серотонинергического действия с СИОЗС (шафран — по механизму, гарциния — единичные случаи).' },
  // онкология
  { c: 'hormcancer', sev: 2, sel: ['id:bpc157'], t: 'BPC-157 стимулирует ангиогенез и рост тканей — при опухолях (в т. ч. в анамнезе) не назначать без онколога.' },
  { c: 'hormcancer', sev: 3, sel: m => m.T.has('estrogen') || m.T.has('androgen') || m.T.has('estrogenprec') || m.T.has('progestogen') || m.id === 'preg', t: 'Гормон или его предшественник: противопоказан при гормонозависимых опухолях.' },
  { c: 'hormcancer', sev: 2, sel: ['phytoestrogen', 'hpgboost', 'id:ipamorelin'], t: 'Фитоэстроген / стимулятор гормональной оси (для ипаморелина — ось ГР/ИФР-1).' },
  { c: 'hormcancer', sev: 1, sel: ['phytoestrogen_mild', 'estromet'], t: 'Влияет на метаболизм эстрогенов — согласовать с онкологом.' },
  // щитовидная
  { c: 'thyroid', sev: 2, sel: ['iodide'], t: 'Иод при аутоиммунном тиреоидите и гипертиреозе может ухудшить течение.' },
  { c: 'thyroid', sev: 2, sel: ['thyroid_up'], t: 'Ашваганда повышает уровень T4 — осторожно при гипертиреозе и на левотироксине.' },
  { c: 'thyroid', sev: 2, sel: ['thyroid_tpo'], t: 'Изофлавоны угнетают тиреопероксидазу и снижают всасывание левотироксина.' },
  { c: 'thyroid', sev: 2, sel: ['labinterf'], t: 'Биотин искажает анализы на ТТГ и тиреоидные гормоны — отменить за 2–3 дня до анализа.' },
  { c: 'thyroid', sev: 2, sel: m => (m.kind === 'mineral' && ['Fe', 'Ca', 'Mg', 'Zn'].some(e => m.T.has(e))) || m.T.has('fibre'), t: 'Снижает всасывание левотироксина — интервал не менее 4 часов.' },
  // печень
  { c: 'liver', sev: 3, sel: ['hepatox'], t: 'Описана гепатотоксичность (ниацин, высокие дозы ЭГКГ, чистотел).' },
  { c: 'liver', sev: 2, sel: ['id:garcinia'], t: 'Описаны случаи лекарственного гепатита на препаратах гарцинии — контроль печёночных проб.' },
  { c: 'liver', sev: 2, sel: ['hepatox_rare', 'id:retinol', 'id:testo', 'id:fadogia', 'id:dhea', 'id:anastrozole'], t: 'Возможна нагрузка на печень — контроль печёночных проб.' },
  // почки
  { c: 'kidney', sev: 3, sel: ['id:metformin'], t: 'Метформин противопоказан при СКФ < 30 мл/мин (риск лактоацидоза).' },
  { c: 'kidney', sev: 2, sel: m => m.kind === 'mineral' && ['Mg', 'K'].some(e => m.T.has(e)), t: 'При ХБП — риск гипермагниемии / гиперкалиемии.' },
  { c: 'kidney', sev: 2, sel: m => m.kind === 'mineral' && m.T.has('Ca'), t: 'Кальций: риск камней и кальцификации при ХБП.' },
  { c: 'kidney', sev: 2, sel: ['vitc'], t: 'Высокие дозы витамина C повышают экскрецию оксалатов — риск оксалатных камней.' },
  { c: 'kidney', sev: 2, sel: ['mineralocort', 'id:sitagliptin', 'id:crpic'], t: 'Требуется коррекция или осторожность при сниженной функции почек.' },
  { c: 'kidney', sev: 2, sel: ['id:horsechest'], t: 'Эсцин в высоких дозах нефротоксичен — осторожно при ХБП.' },
  // иммунитет
  { c: 'autoimmune', sev: 2, sel: ['immunostim'], t: 'Иммуностимулирующее действие — может обострять аутоиммунный процесс или ослаблять иммуносупрессию.' },
  // прочее
  { c: 'ironover', sev: 3, sel: ['Fe'], t: 'Железо противопоказано при перегрузке железом.' },
  { c: 'ironover', sev: 2, sel: ['vitc', 'vitc_source'], t: 'Витамин C усиливает всасывание железа.' },
  { c: 'ulcer', sev: 3, sel: ['id:betainehcl'], t: 'Бетаина гидрохлорид (кислота) противопоказан при язве и эрозиях.' },
  { c: 'ulcer', sev: 2, sel: ['id:succinic', 'id:garlic'], t: 'Раздражает слизистую желудка — после еды.' },
  { c: 'ulcer', sev: 2, sel: ['id:niacin', 'fibrinolytic', 'id:nac'], t: 'Может раздражать слизистую или усиливать риск кровотечения.' },
  { c: 'gout', sev: 3, sel: ['id:niacin'], t: 'Ниацин повышает уровень мочевой кислоты.' },
  { c: 'gout', sev: 1, sel: ['id:fefum'], t: 'Учесть при подагре.' }
];

/* ---------- Общие предостережения (без привязки к пациенту) ---------- */
const GENERAL_NOTES = [
  { tag: 'rx', t: 'Рецептурный препарат — назначение по показаниям, с учётом противопоказаний инструкции.' },
  { tag: 'testtox', t: 'Ограниченные данные безопасности: в доклинике описана тестикулярная токсичность — короткие курсы.' },
  { tag: 'teratogen', t: 'Тератогенен в высоких дозах.' },
  { tag: 'mineralocort', t: 'Длительный приём: задержка натрия, гипокалиемия, повышение давления.' },
  { tag: 'labinterf', t: 'Искажает иммуноанализы (ТТГ, тропонин, гормоны) — отменить за 2–3 дня до анализов.' },
  { tag: 'b12depl', t: 'Длительный приём снижает уровень B12 — контроль или добавление B12.' }
];

/* синергии и правила, которые в врачебной версии не нужны (технологические) */
const DOC_SKIP_RULES = new Set(['syn_edta', 'syn_trehalose', 'syn_antiox_lipid', 'syn_taste', 'abx_probiotic_excipient']);

/* ---------- Примеры ---------- */
const DOC_EXAMPLES = [
  { n: 'Энергия и антиэйдж', items: 'nmn tmg resv coq10 pqq' },
  { n: 'Сон и стресс', items: 'melatonin mgbis glycine theanine' },
  { n: 'Углеводный обмен на метформине', items: 'metformin berberine ala crpic mecbl', cond: ['diab'] },
  { n: 'Мужское здоровье', items: 'tadalafil arg cit tongkat znpic' },
  { n: 'Синефрин + мелатонин', items: 'synephrine melatonin' },
  { n: 'Железо, кальций, витамин C', items: 'fefum cacit vitc' },
  { n: 'Настроение: 5-HTP + SAMe + родиола', items: 'htp same rhodiola', cond: ['ssri'] },
  { n: 'Кровоток: наттокиназа + гинкго + омега-3', items: 'nattokinase ginkgo dha vite curcumin', cond: ['anticoag'] },
  { n: 'Женское здоровье', items: 'dim inositol vitd3 mthf' },
  { n: 'Суставы', items: 'glucosamine chondroitin boswellia curcumin piperine vitd3 vitk2' }
];

/* Уточнения групповых правил для врачебной версии */
(function () {
  const g = GROUP_RULES.find(x => x.id === 'g_hypotens');
  if (g) g.sev = (ms, sum) => (sum >= 8 ? 3 : (ms.some(m => m.T.has('pde5')) || sum >= 4) ? 2 : 1);
})();

/* ---------- Дополнительные синергии для врачебной версии ----------
 * a, b — селекторы (тег, 'id:...', массив); type — тип; t — пояснение (одна фраза). */
const DOC_SYN = [
  { a: ['id:nmn', 'id:nr', 'id:nmnh', 'id:nad'], b: ['id:resv', 'id:pterost'], type: 'НАД+ и сиртуины', t: 'Предшественник НАД+ даёт субстрат сиртуинам, стильбен их активирует.' },
  { a: ['id:quercetin'], b: ['id:fisetin', 'id:resv'], type: 'Сенолитики / полифенолы', t: 'Дополняют друг друга по сенолитическому и противовоспалительному действию.' },
  { a: ['id:quercetin'], b: ['id:bromelain'], type: 'Биодоступность', t: 'Бромелайн улучшает всасывание кверцетина и усиливает противовоспалительный эффект.' },
  { a: ['id:quercetin'], b: ['Zn'], type: 'Иммунитет', t: 'Кверцетин работает как ионофор цинка, облегчая его вход в клетку.' },
  { a: ['Zn'], b: ['vitc', 'id:vitd3'], type: 'Иммунитет', t: 'Цинк, витамин C и D3 поддерживают разные звенья иммунного ответа.' },
  { a: ['id:curcumin', 'id:curc_mic'], b: ['id:boswellia', 'id:ginger', 'id:dha'], type: 'Противовоспалительное', t: 'Разные механизмы подавления воспаления (NF-κB, 5-ЛОГ, ЦОГ, резольвины) — эффекты суммируются.' },
  { a: ['id:boswellia'], b: ['id:glucosamine', 'id:chondroitin'], type: 'Суставы', t: 'Противовоспалительное действие дополняет хондропротекцию.' },
  { a: ['id:hyaluronate'], b: ['id:chondroitin'], type: 'Суставы', t: 'Компоненты матрикса хряща и синовиальной жидкости.' },
  { a: ['Mg'], b: ['id:glycine', 'id:theanine'], type: 'Сон', t: 'Магний снижает нервно-мышечную возбудимость, глицин и теанин облегчают засыпание.', not: m => m.T.has('Mg') && m.kind !== 'mineral' },
  { a: ['id:ashwagandha'], b: ['id:rhodiola', 'id:theanine'], type: 'Стресс', t: 'Адаптогенное и анксиолитическое действие дополняют друг друга.' },
  { a: ['id:htp'], b: ['b6'], type: 'Кофактор', t: 'B6 — кофактор превращения 5-HTP в серотонин.' },
  { a: ['id:same'], b: ['b12', 'id:mthf', 'id:folic'], type: 'Метилирование', t: 'B12 и фолат нужны для регенерации метионина и SAMe.' },
  { a: ['id:nac', 'id:gsh'], b: ['Se'], type: 'Глутатион', t: 'Селен — кофактор глутатионпероксидазы, использующей глутатион.' },
  { a: ['id:ala'], b: ['id:benfo', 'id:thiamine'], type: 'Нейропатия', t: 'Альфа-липоевая кислота и бенфотиамин — сочетание при диабетической нейропатии.' },
  { a: ['id:berberine'], b: ['id:silymarin'], type: 'Биодоступность', t: 'Силимарин тормозит P-гликопротеин и повышает биодоступность берберина.' },
  { a: ['id:inositol'], b: ['id:dci', 'id:mthf', 'id:folic'], type: 'Инсулинорезистентность, СПКЯ', t: 'Мио- и D-хиро-инозитол (40:1) и фолат — сочетание при СПКЯ.' },
  { a: ['id:arg', 'id:cit'], b: ['id:pycno'], type: 'Эндотелий', t: 'Пикногенол активирует eNOS, аргинин/цитруллин дают субстрат для NO.' },
  { a: ['Fe'], b: ['b12', 'id:mthf', 'id:folic'], type: 'Кроветворение', t: 'Железо, B12 и фолат нужны вместе для синтеза гемоглобина и деления эритроцитов.' },
  { a: ['id:vitk2'], b: ['Ca'], type: 'Кости', t: 'K2 активирует остеокальцин, направляя кальций в кость.' },
  { a: ['id:boron'], b: ['id:vitd3', 'Mg'], type: 'Кости', t: 'Бор продлевает действие витамина D и улучшает обмен магния.' },
  { a: ['id:vite'], b: ['pufa'], type: 'Защита омега-3', t: 'Витамин E защищает полиненасыщенные кислоты от окисления в организме.' },
  { a: ['id:lutein'], b: ['id:dha', 'id:astax'], type: 'Зрение', t: 'Лютеин, ДГК и астаксантин защищают сетчатку разными механизмами.' },
  { a: ['enzyme'], b: ['id:betainehcl'], type: 'Пищеварение', t: 'Кислота желудка и ферменты дополняют друг друга.', not: m => ['nattokinase', 'sod', 'catalase', 'gpx', 'bromelain'].includes(m.id) },
  { a: ['id:silymarin'], b: ['id:nac', 'id:tudca', 'id:artichoke'], type: 'Печень', t: 'Гепатопротекция разными механизмами (антиоксидант, желчеотток, мембраны).' },
  { a: ['id:sawpalm'], b: ['id:pygeum', 'id:pumpkin', 'id:nettle'], type: 'Простата', t: 'Классические комбинации при ДГПЖ.' },
  { a: ['id:biotin'], b: ['Zn'], type: 'Кожа и волосы', t: 'Биотин и цинк нужны для роста волос и ногтей.' },
  { a: ['id:uridine', 'id:ump'], b: ['id:dha', 'chol'], type: 'Синапсы', t: 'Уридин, ДГК и холин — субстраты синтеза фосфолипидов мембран нейронов.' },
  { a: ['id:coq10'], b: ['id:dha', 'id:mgorot', 'id:mgtaur'], type: 'Сердце', t: 'Поддержка энергетики миокарда и липидного обмена.' },
  { a: ['id:melatonin'], b: ['id:theanine', 'id:apigenin'], type: 'Сон', t: 'Циркадный сигнал и мягкое анксиолитическое действие.' },
  { a: ['id:b2'], b: ['b6', 'id:mthf', 'id:folic'], type: 'Кофакторы', t: 'Рибофлавин (FMN/FAD) нужен для активации B6 (PNPO) и работы MTHFR в фолатном цикле.' },
  { a: ['id:b2'], b: ['id:coq10', 'Mg'], type: 'Профилактика мигрени', t: 'Рибофлавин, коэнзим Q10 и магний — комбинация с доказательной базой при мигрени.' },
  { a: ['id:butyrate'], b: ['prebiotic', 'id:arabinogalactan', 'id:akkermansia', 'id:nag'], type: 'Кишечный барьер', t: 'Бутират питает колоноциты; пребиотики и Аккермансия поддерживают его эндогенную выработку и слой слизи.' },
  { a: ['id:slipelm', 'id:marshmallow', 'id:aloe', 'id:okra', 'id:plantain'], b: ['id:slipelm', 'id:marshmallow', 'id:aloe', 'id:nag', 'id:calendula', 'id:chamomile', 'id:bpc157'], type: 'Защита слизистой', t: 'Обволакивающие слизи и противовоспалительные компоненты дополняют друг друга при гастрите и синдроме раздражённого кишечника.' },
  { a: ['id:sflecithin'], b: ['id:curcumin', 'id:silymarin', 'id:berberine', 'id:coq10', 'id:boswellia', 'id:quercetin'], type: 'Биодоступность (фитосома)', t: 'Фосфатидилхолин образует с полифенолами фитосомы — всасывание растёт в разы.' },
  { a: ['id:horsechest'], b: ['id:diosmin', 'id:citrus', 'id:pycno', 'id:grapeseed'], type: 'Венотоники', t: 'Эсцин и флавоноиды укрепляют вены и капилляры разными механизмами.' },
  { a: ['id:chamomile'], b: ['Mg', 'id:glycine', 'id:theanine', 'id:melatonin'], type: 'Сон', t: 'Апигенин ромашки действует на бензодиазепиновый сайт GABA-A и дополняет другие компоненты для сна.' },
  { a: ['id:febis'], b: ['b12', 'id:mthf', 'id:folic', 'id:b2'], type: 'Кроветворение', t: 'Железо, B12, фолат и рибофлавин вместе нужны для эритропоэза.' },
  { a: ['id:mgthr'], b: ['id:agpc', 'id:citicoline', 'id:lionsmane', 'id:bacopa'], type: 'Когнитивные функции', t: 'Треонат магния поддерживает синаптическую пластичность, холинергические и нейротрофические компоненты дополняют его.' },
  { a: ['id:succinic'], b: ['id:coq10', 'id:ala', 'id:nmn', 'id:b2'], type: 'Митохондриальная поддержка', t: 'Сукцинат — субстрат комплекса II дыхательной цепи, остальные компоненты поддерживают перенос электронов и НАД+.' },
  { a: ['id:garlic'], b: ['id:dha', 'id:sterols', 'id:coq10'], type: 'Липидный профиль и сосуды', t: 'Чеснок снижает агрегацию и давление, омега-3 и стеролы — триглицериды и ЛПНП: дополняющие механизмы (следить за суммарной кровоточивостью).' },
  { a: ['id:saffron'], b: ['id:curcumin', 'id:mgthr', 'id:mgbis'], type: 'Настроение', t: 'Шафран и куркумин (или магний) улучшали показатели депрессии в РКИ в комбинации.' },
  { a: ['id:aucubin'], b: ['id:silymarin', 'id:nac', 'id:sflecithin'], type: 'Печень', t: 'Гепатопротекция разными механизмами (противовоспалительное, антиоксидант, мембраны).' },
  { a: ['id:theanine'], b: ['id:tyr'], type: 'Концентрация', t: 'Тирозин поддерживает дофамин под нагрузкой, теанин снимает напряжение.' }
];

// элементные теги (Zn, Mg, …) в синергиях — только для минералов, не для ферментов и экстрактов
DOC_SYN.forEach(R => ['a', 'b'].forEach(k => {
  R[k] = [].concat(R[k]).map(s => (typeof s === 'string' && /^(Zn|Mg|Ca|Fe|Se|Cu|K)$/.test(s)) ? (m => m.kind === 'mineral' && m.T.has(s)) : s);
}));
// класс-дубликат: из одного класса в подсказках — не больше одного вещества и не тот, что уже есть
const DUP_KEYS = ['nadprec', 'Mg', 'Ca', 'Zn', 'Fe', 'Se', 'vitc', 'b6', 'b12', 'iu_d', 'vitk', 'ldopa', 'stilbene', 'bileacid', 'glp1', 'phytoestrogen', 'estromet', 'carotenoid'];
function dupKey(m) { const k = DUP_KEYS.find(t => m.T.has(t)); if (k) return k; if (['mthf', 'folic'].includes(m.id)) return 'folate'; if (['gsh', 'sag', 'gsh_lipo'].includes(m.id)) return 'gsh'; if (['curcumin', 'curc_mic', 'thc'].includes(m.id)) return 'curc'; if (['inositol', 'dci'].includes(m.id)) return null; return null; }
