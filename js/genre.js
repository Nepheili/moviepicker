/* ==========================================================================
   genre.js — универсальная страница жанра: genre.html?name=Action
   Показывает топ-20 жанра (из genres.json), сортировку, фильтр по
   минимальному рейтингу и переключатель «сетка/список».
   Настройки сортировки и фильтра сохраняются в адресной строке,
   режим отображения — в localStorage.
   ========================================================================== */
(function () {
  "use strict";

  const MP = window.MP;

  // Функции сортировки. Для «По дате» — сначала новые фильмы.
  const SORTERS = {
    popularity: (a, b) => b.popularity - a.popularity,
    rating: (a, b) => b.vote_average - a.vote_average || b.vote_count - a.vote_count,
    date: (a, b) => (b.release_date || "").localeCompare(a.release_date || "")
  };

  const state = {
    genre: null,     // объект жанра из genres.json
    ranks: new Map(),// id -> место в топе по популярности (номер не меняется при сортировке)
    sort: "popularity",
    minRating: 0,
    view: "grid"
  };

  let elements = {};

  document.addEventListener("DOMContentLoaded", () => {
    elements = {
      title: document.getElementById("genre-title"),
      subtitle: document.getElementById("genre-subtitle"),
      emoji: document.getElementById("genre-emoji"),
      grid: document.getElementById("movie-grid"),
      sort: document.getElementById("sort-select"),
      range: document.getElementById("rating-range"),
      rangeValue: document.getElementById("rating-value"),
      info: document.getElementById("result-info"),
      viewButtons: document.querySelectorAll("[data-view]")
    };

    readParams();
    bindControls();
    elements.grid.innerHTML = MP.renderSkeletons(8);

    const params = new URLSearchParams(location.search);
    const name = params.get("name");

    MP.loadGenres()
      .then((genres) => {
        // Ищем жанр без учёта регистра: ?name=action тоже сработает
        const genre = name && genres.find((g) => g.name.toLowerCase() === name.toLowerCase());
        if (!genre) return showNotFound(name, genres);

        state.genre = genre;
        genre.top20.forEach((m, i) => state.ranks.set(m.id, i + 1));
        MP.registerMovies(genre.top20);
        renderHeader();
        render();
      })
      .catch((error) => {
        elements.title.textContent = "Ошибка загрузки";
        elements.grid.innerHTML = MP.renderState("Не удалось загрузить данные",
          `<p>${MP.escapeHtml(error.message)}</p>`, true);
      })
      .finally(() => elements.grid.removeAttribute("aria-busy"));
  });

  /* Читаем сохранённые настройки из URL и localStorage */
  function readParams() {
    const params = new URLSearchParams(location.search);
    if (SORTERS[params.get("sort")]) state.sort = params.get("sort");
    const min = parseFloat(params.get("min"));
    if (!Number.isNaN(min) && min >= 0 && min <= 10) state.minRating = min;
    state.view = MP.storage.get("moviepicker-view") === "list" ? "list" : "grid";

    elements.sort.value = state.sort;
    elements.range.value = state.minRating;
    updateRangeLabel();
    applyView();
  }

  function bindControls() {
    elements.sort.addEventListener("change", () => {
      state.sort = elements.sort.value;
      syncUrl();
      render();
    });

    elements.range.addEventListener("input", () => {
      state.minRating = parseFloat(elements.range.value);
      updateRangeLabel();
      syncUrl();
      render();
    });

    elements.viewButtons.forEach((button) =>
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        MP.storage.set("moviepicker-view", state.view);
        applyView();
      })
    );
  }

  function updateRangeLabel() {
    elements.rangeValue.textContent = MP.formatRating(parseFloat(elements.range.value));
    elements.range.setAttribute("aria-valuetext", `не ниже ${elements.rangeValue.textContent}`);
  }

  function applyView() {
    elements.grid.classList.toggle("is-list", state.view === "list");
    elements.viewButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === state.view)));
  }

  /* Сохраняем сортировку и фильтр в адресе — ссылкой можно поделиться */
  function syncUrl() {
    const params = new URLSearchParams(location.search);
    state.sort === "popularity" ? params.delete("sort") : params.set("sort", state.sort);
    state.minRating > 0 ? params.set("min", state.minRating) : params.delete("min");
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  }

  function renderHeader() {
    const g = state.genre;
    const ruName = MP.genreName(g.name);
    document.title = `${ruName} — топ-20 фильмов | MoviePicker`;
    elements.title.textContent = ruName;
    elements.emoji.textContent = MP.genreEmoji(g.name);
    const shown = g.top20.length;
    elements.subtitle.textContent =
      `Топ-${shown} фильмов в жанре · всего в жанре ${MP.moviesCount(g.count)}`;
    document.getElementById("list-title").textContent = `Топ-${shown} фильмов в жанре «${ruName}»`;
  }

  function render() {
    if (!state.genre) return;
    const all = state.genre.top20;
    const list = all
      .filter((m) => m.vote_average >= state.minRating)
      .sort(SORTERS[state.sort]);

    elements.info.textContent = `Показано ${list.length} из ${all.length}`;

    if (!list.length) {
      elements.grid.innerHTML = MP.renderState(
        "Нет фильмов с таким рейтингом",
        `<p>Попробуйте уменьшить минимальный рейтинг (сейчас ${MP.formatRating(state.minRating)}).</p>`
      );
      return;
    }

    elements.grid.innerHTML = list
      .map((m) => MP.renderMovieCard(m, { rank: state.ranks.get(m.id), idPrefix: "genre" }))
      .join("");
    MP.observeReveal(elements.grid);
  }

  /* Жанр не найден — показываем список доступных жанров */
  function showNotFound(name, genres) {
    elements.title.textContent = "Жанр не найден";
    elements.subtitle.textContent = name ? `Жанра «${name}» нет в каталоге.` : "Жанр не указан в адресе страницы.";
    document.querySelector(".toolbar").hidden = true;
    const links = genres
      .map((g) => `<a class="chip" href="genre.html?name=${encodeURIComponent(g.name)}">${MP.genreEmoji(g.name)} ${MP.escapeHtml(MP.genreName(g.name))}</a>`)
      .join(" ");
    elements.grid.innerHTML = MP.renderState("Выберите один из доступных жанров",
      `<div class="movie-genres" style="justify-content:center;margin-top:14px">${links}</div>`);
  }
})();
