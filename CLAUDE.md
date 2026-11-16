# nano-formulator — правила для работы в репозитории

Сайт: https://pal2sheff.github.io/nano-formulator/ (GitHub Pages, ветка `main`, папка `docs/`).
Зафиксированная версия сайта до дополнений: ветка `claude/release-site-v1` (коммит 851682e).

## Структура
| Папка | Что это | Адрес на сайте |
|---|---|---|
| `compat-calc/` | Версия технолога + общая база, ядро расчётов, правила, справочник конструктора аптеки, фирменный стиль | `/tehnolog/` |
| `doctor/` | Врачебная версия (подбор состава) | `/vrach/` |
| `site/landing.html` | Главная страница | `/` |
| `addons/<имя>/` | Дополнения (например, калькулятор митопаспорта) | `/<path из addon.json>/` |
| `docs/` | Собранный сайт — не править вручную, только `node build-site.js` | |

## Главное правило для дополнений
Дополнение разрабатывается **только в своей папке `addons/<имя>/`**. Не изменять `compat-calc/`, `doctor/`, `site/`, `build-site.js`, `docs/vrach/`, `docs/tehnolog/` в рамках работы над дополнением.
- Общие данные и код из `compat-calc/` и `doctor/` можно **читать и встраивать при сборке** (база `compat-calc/data/molecules.json`, справочник `compat-calc/data/site_catalog.json`, ядро `compat-calc/src/*.js`, стиль `style.css` + `ni-theme.css`, шрифты), но не менять.
- Если без изменения общей части не обойтись — остановиться и спросить пользователя; это отдельный pull request.
- Как устроено дополнение и шаблон — `addons/README.md`, `addons/_template/`.

## Сборка и проверка
    node build-site.js                          # обе версии + дополнения + главная → docs/
    cd compat-calc && npm test                  # тесты движка технолога
    cd doctor && node --test test/doc.test.js   # тесты врачебной версии
    node compat-calc/test/browser.js; node doctor/test/browser.js   # проверка в Chromium
Перед pull request все тесты основной части должны проходить без изменений, а `docs/vrach/` и `docs/tehnolog/` — не меняться (проверить `git diff --stat docs/`).

## Публикация
Сессия может пушить только в ветки `claude/…`. Работа: ветка `claude/<задача>` → pull request в `main` → пользователь сливает → GitHub Pages обновляется за 1–2 минуты.

## Язык и стиль
Интерфейс и тексты — на русском. Фирменный стиль сайта nano-identica.com (`compat-calc/src/ni-theme.css`: `--ni-blue #153983`, `--ni-green #62B985`, заголовки Unbounded). Расчёты помечать как оценочные; рекомендаций по дозам вне справочника аптеки не давать.
