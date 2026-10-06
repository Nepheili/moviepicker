/* ==========================================================================
   common.js — общая логика для всех страниц:
   тема, мобильное меню, кнопка «Наверх», отрисовка карточек фильмов,
   анимация появления (IntersectionObserver), делегирование «Подробнее».
   Подключается после data-loader.js.
   ========================================================================== */
(function () {
  "use strict";

  const MP = (window.MP = window.MP || {});

  /* ---------- Безопасная работа с localStorage ---------- */
  // В приватном режиме или при запрете cookies доступ может бросать исключение
  MP.storage = {
    get(key, fallback = null) {
      try { return localStorage.getItem(key) ?? fallback; } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* игнорируем */ }
    }
  };

  /* ---------- Переключатель темы ---------- */
  // Начальная тема выставляется маленьким скриптом в <head>, чтобы не было «мигания».
  function initThemeToggle() {
    const button = document.querySelector("[data-theme-toggle]");
    if (!button) return;

    const update = () => {
      const isLight = document.documentElement.dataset.theme === "light";
      button.textContent = isLight ? "🌙" : "☀️";
      button.setAttribute("aria-label", isLight ? "Включить тёмную тему" : "Включить светлую тему");
      button.title = button.getAttribute("aria-label");
    };

    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      MP.storage.set("moviepicker-theme", next);
      update();
    });
    update();
  }

  /* ---------- Мобильное меню ---------- */
  function initMenu() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const nav = document.getElementById("main-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "✕" : "☰";
    });
  }

  /* ---------- Кнопка «Наверх» ---------- */
  function initToTop() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "to-top";
    button.textContent = "↑";
    button.setAttribute("aria-label", "Наверх");
    button.title = "Наверх";
    document.body.appendChild(button);

    const onScroll = () => button.classList.toggle("is-visible", window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  /* ---------- Реестр фильмов на странице (id -> объект) ---------- */
  MP.movieIndex = new Map();
  MP.registerMovies = (list) => list.forEach((m) => MP.movieIndex.set(m.id, m));

  /* ---------- Тексты тултипов ---------- */
  MP.TOOLTIPS = {
    rating: "Рейтинг — средняя оценка зрителей TMDB по шкале от 0 до 10.",
    popularity: "Популярность — индекс TMDB: учитывает просмотры страницы, оценки и добавления в избранное за последнее время. Чем больше число, тем сильнее интерес к фильму сейчас.",
    votes: "Голосов — сколько зрителей поставили оценку фильму."
  };

  /* ---------- Карточка фильма ---------- */
  /**
   * @param {object} movie   объект из movies.json
   * @param {object} options { rank, highlight, idPrefix }
   *   rank      — номер в топе (бейдж на постере)
   *   highlight — функция подсветки совпадений (для поиска), принимает текст, возвращает HTML
   */
  MP.renderMovieCard = (movie, options = {}) => {
    const esc = MP.escapeHtml;
    const mark = options.highlight || esc;
    const titleId = `${options.idPrefix || "movie"}-title-${movie.id}`;
    const rating = MP.formatRating(movie.vote_average);
    const popularity = MP.formatNumber(movie.popularity);
    const year = MP.year(movie.release_date);

    const genres = movie.genres
      .map((g) => `<a class="chip" href="genre.html?name=${encodeURIComponent(g)}">${esc(MP.genreName(g))}</a>`)
      .join("");

    return `
      <article class="movie-card reveal" aria-labelledby="${titleId}">
        <div class="movie-poster">
          <img src="${esc(MP.posterUrl(movie.poster_url))}"
               data-original="${esc(movie.poster_url)}"
               alt="Постер фильма «${esc(movie.title)}»"
               loading="lazy" decoding="async" width="342" height="513"
               onerror="MP.handlePosterError(this)">
          ${options.rank ? `<span class="movie-rank" aria-label="Место в топе: ${options.rank}">${options.rank}</span>` : ""}
          ${year ? `<span class="movie-year">${year}</span>` : ""}
        </div>
        <div class="movie-body">
          <h3 class="movie-title" id="${titleId}">${mark(movie.title)}</h3>
          <div class="movie-meta">
            <span class="meta-item" tabindex="0" data-tooltip="${esc(MP.TOOLTIPS.rating)}"
                  aria-label="Рейтинг: ${rating} из 10">
              <span aria-hidden="true">⭐</span><span class="meta-value">${rating}</span>
            </span>
            <span class="meta-item" tabindex="0" data-tooltip="${esc(MP.TOOLTIPS.popularity)}"
                  aria-label="Популярность: ${popularity}">
              <span aria-hidden="true">🔥</span><span class="meta-value">${popularity}</span>
            </span>
          </div>
          <p class="movie-overview">${esc(MP.truncate(movie.overview, 180))}</p>
          <div class="movie-genres" aria-label="Жанры">${genres}</div>
          <button type="button" class="button button-primary" data-open-movie="${movie.id}"
                  aria-haspopup="dialog" aria-label="Подробнее о фильме «${esc(movie.title)}»">
            Подробнее
          </button>
        </div>
      </article>`;
  };

  /* Скелетоны на время загрузки */
  MP.renderSkeletons = (count = 8) =>
    Array.from({ length: count }, () => '<div class="skeleton-card" aria-hidden="true"></div>').join("");

  /* Сообщение-состояние (пусто / ошибка) */
  MP.renderState = (title, text = "", isError = false) =>
    `<div class="state${isError ? " error" : ""}" role="${isError ? "alert" : "status"}">
       <strong>${MP.escapeHtml(title)}</strong>${text}
     </div>`;

  /* ---------- Анимация появления (IntersectionObserver) ---------- */
  let observer = null;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.08 }
    );
  }

  MP.observeReveal = (root = document) => {
    const items = root.querySelectorAll(".reveal:not(.is-visible)");
    items.forEach((el, i) => {
      // Лёгкая «лесенка»: карточки одного ряда появляются друг за другом
      el.style.setProperty("--reveal-delay", `${(i % 4) * 70}ms`);
      if (observer) observer.observe(el);
      else el.classList.add("is-visible");
    });
  };

  /* ---------- Делегирование кликов по «Подробнее» ---------- */
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-movie]");
    if (!trigger) return;
    const movie = MP.movieIndex.get(Number(trigger.dataset.openMovie));
    if (movie && MP.Modal) MP.Modal.open(movie, trigger);
  });

  /* ---------- Инициализация ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initThemeToggle();
    initMenu();
    initToTop();
    const yearEl = document.querySelector("[data-current-year]");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });
})();
