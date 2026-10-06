/* ==========================================================================
   data-loader.js — загрузка JSON-данных и общие справочники/утилиты.
   Всё складываем в глобальный объект window.MP, чтобы обойтись без сборщика
   и ES-модулей (так сайт работает на любом статическом хостинге).
   ========================================================================== */
(function () {
  "use strict";

  const MP = (window.MP = window.MP || {});

  /* ---------- Справочник жанров: русское название + эмодзи ---------- */
  // ПРЕДПОЛОЖЕНИЕ: в датасете 19 жанров TMDB. Если появится новый жанр,
  // он отобразится с исходным английским названием и иконкой 🎞️.
  MP.GENRES = {
    "Action":          { ru: "Боевик",            emoji: "💥" },
    "Adventure":       { ru: "Приключения",       emoji: "🧭" },
    "Animation":       { ru: "Мультфильм",        emoji: "🎨" },
    "Comedy":          { ru: "Комедия",           emoji: "😂" },
    "Crime":           { ru: "Криминал",          emoji: "🕵️" },
    "Documentary":     { ru: "Документальный",    emoji: "🎥" },
    "Drama":           { ru: "Драма",             emoji: "🎭" },
    "Family":          { ru: "Семейный",          emoji: "👨‍👩‍👧" },
    "Fantasy":         { ru: "Фэнтези",           emoji: "🧙" },
    "History":         { ru: "История",           emoji: "🏛️" },
    "Horror":          { ru: "Ужасы",             emoji: "👻" },
    "Music":           { ru: "Музыка",            emoji: "🎵" },
    "Mystery":         { ru: "Детектив",          emoji: "🔍" },
    "Romance":         { ru: "Мелодрама",         emoji: "💘" },
    "Science Fiction": { ru: "Фантастика",        emoji: "🚀" },
    "TV Movie":        { ru: "Телефильм",         emoji: "📺" },
    "Thriller":        { ru: "Триллер",           emoji: "🔪" },
    "War":             { ru: "Военный",           emoji: "⚔️" },
    "Western":         { ru: "Вестерн",           emoji: "🤠" }
  };

  MP.genreName = (name) => (MP.GENRES[name] ? MP.GENRES[name].ru : name);
  MP.genreEmoji = (name) => (MP.GENRES[name] ? MP.GENRES[name].emoji : "🎞️");

  /* ---------- Языки оригинала (ISO 639-1 -> по-русски) ---------- */
  const LANGUAGES = {
    en: "Английский", ja: "Японский", es: "Испанский", fr: "Французский",
    ko: "Корейский", zh: "Китайский", cn: "Кантонский", it: "Итальянский",
    de: "Немецкий", ru: "Русский", pt: "Португальский", hi: "Хинди",
    no: "Норвежский", nb: "Норвежский (букмол)", da: "Датский", sv: "Шведский", nl: "Нидерландский",
    pl: "Польский", tr: "Турецкий", th: "Тайский", id: "Индонезийский",
    tl: "Тагальский", te: "Телугу", ta: "Тамильский", ml: "Малаялам",
    fi: "Финский", is: "Исландский", uk: "Украинский", ar: "Арабский",
    he: "Иврит", fa: "Персидский", el: "Греческий", hu: "Венгерский",
    cs: "Чешский", ro: "Румынский", sr: "Сербский", ms: "Малайский",
    la: "Латынь", eu: "Баскский", ca: "Каталанский", lv: "Латышский",
    et: "Эстонский", bn: "Бенгальский", gl: "Галисийский"
  };
  // Если кода нет в справочнике — показываем сам код в верхнем регистре
  MP.languageName = (code) => LANGUAGES[code] || (code ? code.toUpperCase() : "—");

  /* ---------- Форматирование ---------- */
  const numberFormat = new Intl.NumberFormat("ru-RU");
  const decimalFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
  const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  MP.formatNumber = (n) => numberFormat.format(Math.round(n || 0));
  MP.formatRating = (n) => decimalFormat.format(n || 0);
  MP.formatDate = (iso) => {
    if (!iso) return "—";
    // Разбираем вручную, чтобы не было сдвига на день из-за часового пояса
    const [y, m, d] = iso.split("-").map(Number);
    return dateFormat.format(new Date(y, m - 1, d));
  };
  MP.year = (iso) => (iso ? iso.slice(0, 4) : "");

  /* Склонение: 1 фильм, 2 фильма, 5 фильмов */
  MP.plural = (n, one, few, many) => {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  };
  MP.moviesCount = (n) => `${MP.formatNumber(n)} ${MP.plural(n, "фильм", "фильма", "фильмов")}`;

  /* Обрезка текста по границе слова (~180 символов в карточке) */
  MP.truncate = (text, limit = 180) => {
    if (!text || text.length <= limit) return text || "";
    const cut = text.slice(0, limit);
    const lastSpace = cut.lastIndexOf(" ");
    return cut.slice(0, lastSpace > limit * 0.6 ? lastSpace : limit).replace(/[\s,.;:—-]+$/, "") + "…";
  };

  /* Экранирование HTML — данные из датасета вставляем только через него */
  MP.escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));

  /* ---------- Постеры ---------- */
  // ПРЕДПОЛОЖЕНИЕ: в датасете ссылки ведут на /t/p/original/ (картинки по 1–3 МБ).
  // TMDB отдаёт тот же постер в уменьшенных размерах — подменяем размер,
  // чтобы страница грузилась быстрее. Если подмена не сработает, есть запасной вариант.
  MP.posterUrl = (url, size = "w342") =>
    url ? url.replace("/t/p/original/", `/t/p/${size}/`) : MP.POSTER_PLACEHOLDER;

  // Заглушка-SVG (встроенная, работает офлайн)
  MP.POSTER_PLACEHOLDER =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300">' +
        '<rect width="200" height="300" fill="#1A1D23"/>' +
        '<rect x="70" y="112" width="60" height="44" rx="6" fill="none" stroke="#FFB800" stroke-width="4"/>' +
        '<circle cx="100" cy="134" r="11" fill="none" stroke="#FFB800" stroke-width="4"/>' +
        '<text x="100" y="190" font-family="Arial" font-size="14" fill="#9BA1AB" text-anchor="middle">Нет постера</text>' +
      "</svg>"
    );

  // Обработчик ошибки загрузки картинки: сначала пробуем оригинал, потом заглушку
  MP.handlePosterError = (img) => {
    const original = img.dataset.original;
    if (original && img.src !== original && !img.dataset.triedOriginal) {
      img.dataset.triedOriginal = "1";
      img.src = original;
    } else {
      img.onerror = null;
      img.src = MP.POSTER_PLACEHOLDER;
    }
  };

  /* ---------- Загрузка данных ---------- */
  const cache = {};

  function fetchJson(path) {
    if (!cache[path]) {
      cache[path] = fetch(path)
        .then((response) => {
          if (!response.ok) throw new Error(`Не удалось загрузить ${path} (код ${response.status})`);
          return response.json();
        })
        .catch((error) => {
          delete cache[path]; // позволяем повторить попытку
          // Частая причина — сайт открыт двойным кликом (file://), где fetch запрещён
          if (location.protocol === "file:") {
            error = new Error("Откройте сайт через локальный сервер: python -m http.server");
          }
          throw error;
        });
    }
    return cache[path];
  }

  MP.loadMovies = () => fetchJson("data/movies.json");
  MP.loadGenres = () => fetchJson("data/genres.json");

  /* Поиск фильма по id среди уже загруженных списков */
  MP.findMovie = (list, id) => list.find((m) => m.id === Number(id));
})();
