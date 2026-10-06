# MoviePicker 🎬

Статический сайт для выбора фильмов: топ-20 по каждому жанру, поиск, фильтр по рейтингу, сортировка, модальное окно с подробностями. Чистые HTML/CSS/JS, без фреймворков и CDN.

## Структура

```
MoviePicker/
├── index.html          # Главная: жанры + топ-10 + «Случайный фильм»
├── genre.html          # Страница жанра (?name=Action)
├── search.html         # Поиск
├── about.html          # О проекте
├── build_data.py       # CSV -> data/*.json
├── css/style.css, css/animations.css
├── js/data-loader.js   # загрузка JSON, справочники жанров/языков, утилиты
├── js/common.js        # тема, меню, «Наверх», карточки, IntersectionObserver
├── js/main.js, genre.js, search.js, modal.js
└── data/movies.json, data/genres.json
```

`js/common.js` добавлен к исходной структуре: в нём общий код (карточка фильма, тема, кнопка «Наверх»), чтобы не дублировать его на каждой странице.

## 1. Сборка данных

Нужен Python 3.8+ (только стандартная библиотека).

```bash
python build_data.py                          # ищет Top_Movies_dataset.csv рядом со скриптом
python build_data.py "Top Movies dataset.csv" # или путь к файлу
```

Скрипт выводит статистику и пишет `data/movies.json` и `data/genres.json`.
В датасете есть одна «разорванная» запись (Pixie Hollow Bake Off — описание с переносами строк без кавычек), скрипт склеивает её автоматически.

## 2. Запуск локально

Открывать `index.html` двойным кликом нельзя — браузер запрещает `fetch` для `file://`. Запустите простой сервер:

```bash
cd MoviePicker
python -m http.server 8000
```

Откройте http://localhost:8000

## 3. Деплой на GitHub Pages

```bash
cd MoviePicker
git init
git add .
git commit -m "MoviePicker"
git branch -M main
git remote add origin https://github.com/<ваш-логин>/moviepicker.git
git push -u origin main
```

Далее на GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, папка `/ (root)` → Save**.
Через 1–2 минуты сайт будет доступен по адресу `https://<ваш-логин>.github.io/moviepicker/`.

Все пути в проекте относительные, поэтому сайт работает и из подпапки репозитория. Файл `.nojekyll` отключает обработку Jekyll.

## Заметки

- Работает офлайн; из интернета грузятся только постеры (image.tmdb.org). Если постер недоступен — показывается встроенная заглушка.
- Постеры в датасете — в оригинальном размере (1–3 МБ). Сайт запрашивает уменьшенные версии TMDB (`w342` для карточек, `w500` для модального окна), при ошибке пробует оригинал.
- Описания фильмов в датасете на английском, интерфейс — на русском; названия жанров переведены.
- Тема и режим «сетка/список» сохраняются в `localStorage`; сортировка и фильтр — в адресе страницы (ссылкой можно поделиться).
