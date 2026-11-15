/* ===== Врачебная версия: направленность, время приёма, противопоказания ===== */
'use strict';

/* ---------- Направленность ---------- */
const DIRS = {
  energy:  { n: 'Энергия и митохондрии', ids: 'nad nadh nadp nmn nmnh nr nam amp akg coq10 pqq ala alcar lcar cabhb thiamine benfo pantoth b15 motsc shilajit ginseng eleuthero rhodiola schisandra yerba asp ipamorelin' },
  neuro:   { n: 'Мозг, память, внимание', ids: 'agpc citicoline uridine ump dha lionsmane bacopa ginkgo semax tyr ldopa mucuna alcar pqq mecbl cncbl benfo carnosine luteolin preg' },
  sleep:   { n: 'Сон, стресс, настроение', ids: 'melatonin gaba theanine glycine htp same selank dsip apigenin hops ashwagandha tulsi rhodiola mgbis mgtaur mgcit taurine cherry inositol prog oxytocin' },
  vessels: { n: 'Сосуды, кровоток, NO', ids: 'arg cit citmal tadalafil pycno grapeseed ginkgo nattokinase diosmin citrus epimedium niacin' },
  heart:   { n: 'Сердце и липиды', ids: 'coq10 dha sterols berberine niacin oryzanol taurine mgorot mgtaur vitk2 artichoke resv htyr oleuropein pomegranate lycopene betaglucan psyllium lcar' },
  glucose: { n: 'Углеводный обмен и вес', ids: 'metformin sitagliptin semaglutide tirzepatide berberine bittermelon gymnema galega cinnamon opuntia mangiferin cga inositol dci crpic ala fenugreek yerba synephrine fucox keto7 cabhb akkermansia pterost motsc' },
  antiox:  { n: 'Антиоксиданты и антиэйдж', ids: 'gsh sag gsh_lipo nac ergo astax htyr ferulic c60 quercetin fisetin egcg dhq curcumin curc_mic thc pterost resv polygonum vitc vitc_lipo vite sod catalase gpx myricetin rosemary pomegranate roxpear carnosine trehalose spermidine epitalon phycocyanin sulforaphane nmn lycopene' },
  inflam:  { n: 'Противовоспалительное', ids: 'curcumin curc_mic boswellia pea dha quercetin luteolin bromelain ginger andrographolide cape apigenin ursolic oleanolic phycocyanin spirulina cherry catsclaw' },
  liver:   { n: 'Печень, желчь, детокс', ids: 'silymarin phospholip nac gsh sag gsh_lipo tudca udca artichoke dandelion sulforaphane tmg schisandra glycyrrhizin orn gardenia same' },
  gut:     { n: 'ЖКТ и микробиом', ids: 'pancrelipase amylase lactase cellulase maltdiast phytase papain bromelain akkermansia inulin psyllium fig flax betainehcl gentian ginger tannins lionsmane glycyrrhizin' },
  immune:  { n: 'Иммунитет', ids: 'vitc vitc_lipo vitd3 znbis znpic zngluc segly semet betaglucan astragalus catsclaw andrographolide spirulina lys retinol' },
  joints:  { n: 'Суставы, кости, кожа', ids: 'glucosamine chondroitin hyaluronate boswellia cacit camal vitd3 vitk2 boron pea biotin astax same ipamorelin' },
  male:    { n: 'Мужское здоровье', ids: 'testo dhea daa tongkat fadogia tribulus fenugreek safedmusli damiana epimedium sawpalm pygeum pumpkin nettle chrysin anastrozole tadalafil pt141 boron znpic' },
  female:  { n: 'Женское здоровье', ids: 'e2 e3 prog redclover soy genistein formononetin hops dim i3c inositol dci flax cagluc diosgenin pt141 dhea' },
  thyroid: { n: 'Щитовидная железа', ids: 'ki segly semet tyr ashwagandha' },
  blood:   { n: 'Кроветворение и метилирование', ids: 'fefum mecbl cncbl mthf folic pyridox p5p tmg same cubis' },
  eyes:    { n: 'Зрение', ids: 'lutein astax dha retinol' }
};
const DIR_OF = {};
for (const k in DIRS) DIRS[k].ids.split(/\s+/).forEach(id => { (DIR_OF[id] = DIR_OF[id] || []).push(k); });
const BIOENH = new Set(['piperine']);

/* ---------- Время приёма ---------- */
function timing(m) {
  const T = m.T, id = m.id;
  let slot = 'any', food = null;
  const morning = T.has('stimulant') || T.has('sympath') || T.has('caffeine') || T.has('thermogenic') || T.has('stimulant_mild') ||
    ['tyr', 'nmn', 'nr', 'nad', 'nadh', 'nmnh', 'alcar', 'dhea', 'preg', 'testo', 'mecbl', 'cncbl', 'pqq', 'semax', 'keto7', 'b15'].includes(id);
  const evening = T.has('sedative') || T.has('hormone_sleep') || T.has('sedative_mild') || ['mgbis', 'mgtaur', 'mgcit', 'prog', 'ashwagandha', 'dsip', 'cherry'].includes(id);
  if (evening && !T.has('stimulant')) slot = 'evening'; else if (morning) slot = 'morning';
  if (T.has('ldopa') || ['htp', 'tyr', 'synephrine', 'akkermansia', 'nmn', 'nr'].includes(id)) food = 'empty';
  if (T.has('lipo') || T.has('fatvit') || T.has('carotenoid') || ['coq10', 'curcumin', 'dha', 'sterols', 'berberine', 'metformin', 'betainehcl', 'cinnamon', 'crpic', 'pea', 'boswellia', 'curc_mic'].includes(id) ||
      (m.kind === 'enzyme' && !['nattokinase', 'bromelain', 'sod', 'catalase', 'gpx'].includes(id))) food = 'food';
  if (id === 'fefum') food = 'empty';
  if (['nattokinase', 'bromelain'].includes(id)) food = 'empty';
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
const PREG_OK = new Set('folic mthf mecbl cncbl pyridox p5p vitd3 vitc ki fefum cacit camal mgcit mgbis mgtaur mgorot znbis znpic zngluc dha inositol glycine lactase pancrelipase psyllium inulin choline'.split(' '));
const CONTRA = [
  // беременность
  { c: 'preg', sev: 3, sel: m => m.T.has('hormone') || m.T.has('androgen') || m.T.has('estrogen') || m.T.has('progestogen') || m.T.has('ai') || m.T.has('antiestro') || m.T.has('estrogenprec'), t: 'Гормональный препарат: при беременности и лактации не назначается вне показаний специалиста.' },
  { c: 'preg', sev: 3, sel: ['teratogen'], t: 'Ретинол в высоких дозах тератогенен.' },
  { c: 'preg', sev: 3, sel: ['glp1', 'dpp4', 'id:galega', 'id:berberine'], t: 'Противопоказан при беременности и лактации (для берберина — риск ядерной желтухи у новорождённого).' },
  { c: 'preg', sev: 3, sel: ['mineralocort', 'id:ashwagandha', 'id:andrographolide', 'id:fenugreek', 'id:tribulus', 'id:tongkat', 'id:fadogia', 'id:mucuna', 'id:ldopa', 'sympath', 'phytoestrogen', 'estromet', 'id:oxytocin', 'id:pt141'], t: 'Не рекомендуется при беременности: гормональное, утеротоническое или стимулирующее действие либо нет данных о безопасности.' },
  { c: 'preg', sev: 2, sel: m => !PREG_OK.has(m.id), t: 'Данных о безопасности при беременности и лактации недостаточно.', fallback: true },
  // кровотечения
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
  // онкология
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
  { c: 'liver', sev: 3, sel: ['hepatox'], t: 'Описана гепатотоксичность (ниацин, высокие дозы ЭГКГ).' },
  { c: 'liver', sev: 2, sel: ['hepatox_rare', 'id:retinol', 'id:testo', 'id:fadogia', 'id:dhea', 'id:anastrozole'], t: 'Возможна нагрузка на печень — контроль печёночных проб.' },
  // почки
  { c: 'kidney', sev: 3, sel: ['id:metformin'], t: 'Метформин противопоказан при СКФ < 30 мл/мин (риск лактоацидоза).' },
  { c: 'kidney', sev: 2, sel: m => m.kind === 'mineral' && ['Mg', 'K'].some(e => m.T.has(e)), t: 'При ХБП — риск гипермагниемии / гиперкалиемии.' },
  { c: 'kidney', sev: 2, sel: m => m.kind === 'mineral' && m.T.has('Ca'), t: 'Кальций: риск камней и кальцификации при ХБП.' },
  { c: 'kidney', sev: 2, sel: ['vitc'], t: 'Высокие дозы витамина C повышают экскрецию оксалатов — риск оксалатных камней.' },
  { c: 'kidney', sev: 2, sel: ['mineralocort', 'id:sitagliptin', 'id:crpic'], t: 'Требуется коррекция или осторожность при сниженной функции почек.' },
  // иммунитет
  { c: 'autoimmune', sev: 2, sel: ['immunostim'], t: 'Иммуностимулирующее действие — может обострять аутоиммунный процесс или ослаблять иммуносупрессию.' },
  // прочее
  { c: 'ironover', sev: 3, sel: ['Fe'], t: 'Железо противопоказано при перегрузке железом.' },
  { c: 'ironover', sev: 2, sel: ['vitc', 'vitc_source'], t: 'Витамин C усиливает всасывание железа.' },
  { c: 'ulcer', sev: 3, sel: ['id:betainehcl'], t: 'Бетаина гидрохлорид (кислота) противопоказан при язве и эрозиях.' },
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
