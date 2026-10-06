/* ==========================================================================
   search.js — живой поиск по Title и Overview (без учёта регистра).
   Дополнительно: фильтр по жанру, минимальному рейтингу и сортировка.
   Результаты выводятся порциями по 24 карточки (кнопка «Показать ещё»),
   чтобы не рисовать тысячи карточек сразу.
   ========================================================================== */
(function () {
  "use strict";

  const MP = window.MP;
  const PAGE_SIZE = 24;
  const DEBOUNCE_MS = 200;

  const SORTERS = {
    popularity: (a, b) => b.popularity - a.popularity,
    rating: (a, b) => b.vote_average - a.vote_average || b.vote_count - a.vote_count,
    date: (a, b) => (b.release_date || "").localeCompare(a.release_date || "")
  };

  let movies = [];
  let results = [];
  let shown = 0;
  let query = "";
  let el = {};

  document.addEventListener("DOMContentLoaded", () => {
    el = {
      form: document.getElementById("search-form"),
      input: document.getElementById("search-input"),
      genre: document.getElementById("genre-filter"),
      sort: document.getElementById("sort-select"),
      range: document.getElementById("rating-range"),
      rangeValue: document.getElementById("rating-value"),
      info: document.getElementById("search-info"),
      results: document.getElementById("results"),
      more: document.getElementById("load-more")
    };

    // Запрос можно передать в адресе: search.html?q=batman
    const params = new URLSearchParams(location.search);
    el.input.value = params.get("q") || "";
    el.results.innerHTML = MP.renderSkeletons(8);

    Promise.all([MP.loadMovies(), MP.loadGenres()])
      .then(([allMovies, genres]) => {
        // Готовим строку для поиска заранее — так фильтрация мгновенная
        movies = allMovies.map((m) => ({ ...m, _haystack: `${m.title}\n${m.overview}`.toLowerCase() }));
        MP.registerMovies(movies);

        el.genre.innerHTML += genres
          .map((g) => `<option value="${MP.escapeHtml(g.name)}">${MP.genreEmoji(g.name)} ${MP.escapeHtml(MP.genreName(g.name))}</option>`)
          .join("");

        bind();
        run();
        el.input.focus();
      })
      .catch((error) => {
        el.results.innerHTML = MP.renderState("Не удалось загрузить каталог",
          `<p>${MP.escapeHtml(error.message)}</p>`, true);
      })
      .finally(() => el.results.removeAttribute("aria-busy"));
  });

  function bind() {
    let timer = null;
    el.input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    });
    // Enter не перезагружает страницу
    el.form.addEventListener("submit", (event) => { event.preventDefault(); run(); });
    el.genre.addEventListener("change", run);
    el.sort.addEventListener("change", run);
    el.range.addEventListener("input", () => {
      el.rangeValue.textContent = MP.formatRating(parseFloat(el.range.value));
      run();
    });
    el.more.addEventListener("click", renderNextPage);
  }

  /* Основная функция: фильтрация + сортировка + первая порция результатов */
  function run() {
    query = el.input.value.trim().toLowerCase();
    const genre = el.genre.value;
    const minRating = parseFloat(el.range.value);
    // Поддержка нескольких слов: фильм должен содержать каждое слово
    const words = query.split(/\s+/).filter(Boolean);

    results = movies.filter((m) =>
      (!genre || m.genres.includes(genre)) &&
      m.vote_average >= minRating &&
      words.every((w) => m._haystack.includes(w))
    );

    // При поиске по названию полные совпадения в названии поднимаем выше
    const sorter = SORTERS[el.sort.value];
    if (words.length && el.sort.value === "popularity") {
      results.sort((a, b) => titleScore(b, words) - titleScore(a, words) || sorter(a, b));
    } else {
      results.sort(sorter);
    }

    // Обновляем адрес без перезагрузки
    const params = new URLSearchParams();
    if (query) params.set("q", el.input.value.trim());
    history.replaceState(null, "", params.toString() ? `?${params}` : location.pathname);

    el.info.textContent = query
      ? `Найдено: ${MP.moviesCount(results.length)}`
      : `Популярное сейчас · всего ${MP.moviesCount(results.length)}`;

    shown = 0;
    el.results.innerHTML = "";
    if (!results.length) {
      el.results.innerHTML = MP.renderState("Ничего не найдено",
        "<p>Проверьте написание, попробуйте другое слово или снимите фильтры.</p>");
      el.more.hidden = true;
      return;
    }
    renderNextPage();
  }

  /* Сколько слов запроса встречается в названии (для ранжирования) */
  function titleScore(movie, words) {
    const title = movie.title.toLowerCase();
    let score = words.filter((w) => title.includes(w)).length;
    if (title === query) score += 10;
    else if (title.startsWith(query)) score += 3;
    return score;
  }

  function renderNextPage() {
    const chunk = results.slice(shown, shown + PAGE_SIZE);
    const html = chunk.map((m) => MP.renderMovieCard(m, { highlight, idPrefix: "search" })).join("");
    el.results.insertAdjacentHTML("beforeend", html);
    shown += chunk.length;
    el.more.hidden = shown >= results.length;
    el.more.textContent = `Показать ещё (осталось ${MP.formatNumber(results.length - shown)})`;
    MP.observeReveal(el.results);
  }

  /* Подсветка совпадений в названии: режем исходный текст на куски
     и экранируем каждый отдельно (чтобы не сломать «&amp;» и т.п.) */
  function highlight(text) {
    const words = query.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!words.length) return MP.escapeHtml(text);
    const pattern = new RegExp(`(${words.join("|")})`, "gi");
    return text
      .split(pattern)
      .map((part, i) => (i % 2 === 1 ? `<mark>${MP.escapeHtml(part)}</mark>` : MP.escapeHtml(part)))
      .join("");
  }
})();
