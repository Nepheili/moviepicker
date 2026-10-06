/* ==========================================================================
   modal.js — модальное окно с полной информацией о фильме.
   Разметка создаётся один раз при первом открытии.
   Доступность: role="dialog", aria-modal, ловушка фокуса, закрытие по Esc
   и по клику на затемнение, возврат фокуса на кнопку, открывшую окно.
   ========================================================================== */
(function () {
  "use strict";

  const MP = (window.MP = window.MP || {});
  let modal, dialog, content, lastTrigger = null;

  const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function build() {
    modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "movie-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="modal-backdrop" data-modal-close></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
        <button type="button" class="icon-button modal-close" data-modal-close aria-label="Закрыть" title="Закрыть">✕</button>
        <div class="modal-content"></div>
      </div>`;
    document.body.appendChild(modal);
    dialog = modal.querySelector(".modal-dialog");
    content = modal.querySelector(".modal-content");

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-modal-close]")) close();
    });
    document.addEventListener("keydown", onKeydown);
  }

  function onKeydown(event) {
    if (!modal || !modal.classList.contains("is-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    // Ловушка фокуса: Tab не выходит за пределы окна
    if (event.key === "Tab") {
      const items = Array.from(dialog.querySelectorAll(FOCUSABLE));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }

  function render(movie) {
    const esc = MP.escapeHtml;
    const rating = MP.formatRating(movie.vote_average);
    const percent = Math.max(0, Math.min(100, movie.vote_average * 10));
    const genres = movie.genres
      .map((g) => `<a class="chip" href="genre.html?name=${encodeURIComponent(g)}">${MP.genreEmoji(g)} ${esc(MP.genreName(g))}</a>`)
      .join(" ");
    const mainGenre = movie.genres[0];

    content.innerHTML = `
      <div class="modal-poster">
        <img src="${esc(MP.posterUrl(movie.poster_url, "w500"))}"
             data-original="${esc(movie.poster_url)}"
             alt="Постер фильма «${esc(movie.title)}»"
             onerror="MP.handlePosterError(this)">
      </div>
      <div class="modal-info">
        <div>
          <h2 id="modal-title">${esc(movie.title)}</h2>
          <p class="muted" style="margin:6px 0 0">${MP.year(movie.release_date)} · ${esc(MP.languageName(movie.language))}</p>
        </div>

        <p class="modal-overview">${esc(movie.overview || "Описание отсутствует.")}</p>

        <dl class="facts">
          <div class="fact">
            <dt><span tabindex="0" data-tooltip="${esc(MP.TOOLTIPS.rating)}">Рейтинг ⓘ</span></dt>
            <dd>⭐ ${rating} <span class="muted" style="font-weight:500">/ 10</span></dd>
            <div class="rating-bar" aria-hidden="true"><span style="width:${percent}%"></span></div>
          </div>
          <div class="fact">
            <dt><span tabindex="0" data-tooltip="${esc(MP.TOOLTIPS.popularity)}">Популярность ⓘ</span></dt>
            <dd>🔥 ${MP.formatNumber(movie.popularity)}</dd>
          </div>
          <div class="fact">
            <dt><span tabindex="0" data-tooltip="${esc(MP.TOOLTIPS.votes)}">Голосов ⓘ</span></dt>
            <dd>${MP.formatNumber(movie.vote_count)}</dd>
          </div>
          <div class="fact">
            <dt>Дата релиза</dt>
            <dd>${MP.formatDate(movie.release_date)}</dd>
          </div>
        </dl>

        <div>
          <p class="muted" style="margin:0 0 8px;font-size:.82rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Жанры</p>
          <div class="movie-genres">${genres}</div>
        </div>

        <div class="modal-actions">
          ${mainGenre ? `<a class="button button-primary" href="genre.html?name=${encodeURIComponent(mainGenre)}">Ещё в жанре «${esc(MP.genreName(mainGenre))}»</a>` : ""}
          <button type="button" class="button button-secondary" data-modal-close>Закрыть</button>
        </div>
      </div>`;
  }

  function open(movie, trigger) {
    if (!modal) build();
    lastTrigger = trigger || document.activeElement;
    render(movie);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    dialog.scrollTop = 0;
    // Фокус на заголовок окна после начала анимации
    requestAnimationFrame(() => dialog.focus());
  }

  function close() {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    if (lastTrigger && typeof lastTrigger.focus === "function") lastTrigger.focus();
  }

  MP.Modal = { open, close };
})();
