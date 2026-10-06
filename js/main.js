/* ==========================================================================
   main.js — логика главной страницы:
   плитки жанров, топ-10 популярных фильмов, статистика, «Случайный фильм».
   ========================================================================== */
(function () {
  "use strict";

  const MP = window.MP;

  // ПРЕДПОЛОЖЕНИЕ: «случайный фильм» выбираем из фильмов, у которых
  // не меньше 100 голосов — иначе часто попадаются малоизвестные короткометражки.
  const RANDOM_MIN_VOTES = 100;

  document.addEventListener("DOMContentLoaded", () => {
    const genreGrid = document.getElementById("genre-grid");
    const topGrid = document.getElementById("top-grid");
    const randomButton = document.getElementById("random-movie");

    genreGrid.innerHTML = Array.from({ length: 8 }, () =>
      '<div class="skeleton-card" style="aspect-ratio:auto;height:80px" aria-hidden="true"></div>').join("");
    topGrid.innerHTML = MP.renderSkeletons(4);

    /* ---------- Жанры и топ-10 (нужен только лёгкий genres.json) ---------- */
    MP.loadGenres()
      .then((genres) => {
        renderGenres(genreGrid, genres);
        renderTop10(topGrid, genres);
        document.getElementById("stat-genres").textContent = genres.length;
      })
      .catch((error) => {
        const message = MP.renderState("Не удалось загрузить данные", `<p>${MP.escapeHtml(error.message)}</p>`, true);
        genreGrid.innerHTML = message;
        topGrid.innerHTML = "";
      })
      .finally(() => {
        genreGrid.removeAttribute("aria-busy");
        topGrid.removeAttribute("aria-busy");
      });

    /* ---------- Полный каталог: статистика и случайный фильм ---------- */
    MP.loadMovies()
      .then((movies) => {
        document.getElementById("stat-movies").textContent = MP.formatNumber(movies.length);
        const rated = movies.filter((m) => m.vote_count > 0);
        const avg = rated.reduce((sum, m) => sum + m.vote_average, 0) / (rated.length || 1);
        document.getElementById("stat-rating").textContent = MP.formatRating(avg);

        const pool = movies.filter((m) => m.vote_count >= RANDOM_MIN_VOTES);
        randomButton.disabled = false;
        randomButton.addEventListener("click", () => {
          const movie = pool[Math.floor(Math.random() * pool.length)];
          MP.registerMovies([movie]);
          MP.Modal.open(movie, randomButton);
        });
      })
      .catch(() => {
        randomButton.title = "Каталог фильмов не загрузился";
      });
  });

  /* Плитки жанров: эмодзи + название + количество фильмов */
  function renderGenres(container, genres) {
    container.innerHTML = genres
      .map((g) => `
        <a class="genre-tile reveal" href="genre.html?name=${encodeURIComponent(g.name)}"
           aria-label="${MP.escapeHtml(MP.genreName(g.name))}: ${MP.moviesCount(g.count)}">
          <span class="genre-emoji" aria-hidden="true">${MP.genreEmoji(g.name)}</span>
          <span>
            <strong>${MP.escapeHtml(MP.genreName(g.name))}</strong>
            <small>${MP.moviesCount(g.count)}</small>
          </span>
        </a>`)
      .join("");
    MP.observeReveal(container);
  }

  /*
   * Топ-10 по всему каталогу считаем по объединению top20 всех жанров.
   * Это корректно: если фильм входит в общий топ-10, то в любом его жанре
   * популярнее него максимум 9 фильмов, значит он точно есть в top20 жанра.
   */
  function renderTop10(container, genres) {
    const unique = new Map();
    genres.forEach((g) => g.top20.forEach((m) => unique.set(m.id, m)));
    const top = Array.from(unique.values())
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 10);

    MP.registerMovies(top);
    container.innerHTML = top
      .map((movie, i) => MP.renderMovieCard(movie, { rank: i + 1, idPrefix: "top" }))
      .join("");
    MP.observeReveal(container);
  }
})();
