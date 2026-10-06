#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_data.py — подготовка данных для сайта MoviePicker.

Что делает скрипт:
  1. Читает CSV-датасет (по умолчанию Top_Movies_dataset.csv рядом со скриптом).
  2. Чинит «разорванные» записи (в датасете есть фильм, у которого описание
     содержит переносы строк без кавычек — CSV разбивает его на 11 строк).
  3. Парсит даты DD/MM/YYYY -> ISO (YYYY-MM-DD), разбивает Genre на список.
  4. Пишет два файла:
       data/movies.json — все фильмы;
       data/genres.json — жанры с количеством фильмов и топ-20 по популярности.
  5. Печатает статистику в консоль.

Запуск:
  python build_data.py                       # ищет Top_Movies_dataset.csv
  python build_data.py "Top Movies dataset.csv"  # можно передать свой путь

Используется только стандартная библиотека Python 3.8+.
"""

import csv
import json
import sys
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Настройки
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CSV_NAMES = ["Top_Movies_dataset.csv", "Top Movies dataset.csv"]
OUT_DIR = BASE_DIR / "data"
TOP_N = 20  # сколько фильмов попадает в топ жанра

# Поля, которые должны быть числами у «полноценной» записи
NUMERIC_FIELDS = ("Popularity", "Vote_Count", "Vote_Average")


def find_csv_path() -> Path:
    """Возвращает путь к CSV: из аргумента командной строки или по имени по умолчанию."""
    if len(sys.argv) > 1:
        path = Path(sys.argv[1])
        if not path.exists():
            sys.exit(f"Файл не найден: {path}")
        return path
    for name in DEFAULT_CSV_NAMES:
        path = BASE_DIR / name
        if path.exists():
            return path
    sys.exit("Не найден CSV-файл. Положите Top_Movies_dataset.csv рядом со скриптом "
             "или передайте путь аргументом.")


def parse_date(value: str):
    """DD/MM/YYYY -> 'YYYY-MM-DD'. Возвращает None, если строка — не дата."""
    try:
        return datetime.strptime((value or "").strip(), "%d/%m/%Y").date().isoformat()
    except ValueError:
        return None


def to_float(value, default=None):
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return default


def to_int(value, default=None):
    number = to_float(value)
    return int(number) if number is not None else default


def is_complete(row: dict) -> bool:
    """Запись полноценная, если у неё есть дата, название и все числовые поля."""
    return (
        parse_date(row.get("Release_Date")) is not None
        and (row.get("Title") or "").strip() != ""
        and all(to_float(row.get(f)) is not None for f in NUMERIC_FIELDS)
    )


def read_rows(csv_path: Path):
    """
    Читает CSV и склеивает разорванные записи.

    ПРЕДПОЛОЖЕНИЕ (выявлено при анализе датасета): если строка начинается
    с корректной даты и названия, но без чисел, а следующие строки начинаются
    НЕ с даты — это продолжение поля Overview. В последнем фрагменте колонки
    сдвинуты на одну влево: [хвост описания, Popularity, Vote_Count,
    Vote_Average, Original_Language, Genre, Poster_Url, ...].
    """
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = [h.strip() for h in next(reader)]
        raw = [r for r in reader if any(cell.strip() for cell in r)]

    rows, repaired, skipped = [], 0, 0
    i = 0
    while i < len(raw):
        row = dict(zip(header, raw[i] + [""] * (len(header) - len(raw[i]))))
        if is_complete(row):
            rows.append(row)
            i += 1
            continue

        # Попытка починить: у записи есть дата и название, но нет чисел
        if parse_date(row.get("Release_Date")) and (row.get("Title") or "").strip():
            overview_parts = [row.get("Overview", "").strip()]
            j = i + 1
            fixed = False
            while j < len(raw) and parse_date(raw[j][0] if raw[j] else "") is None:
                fragment = raw[j]
                overview_parts.append(fragment[0].strip())
                # Фрагмент с числами — конец записи
                if len(fragment) >= 7 and to_float(fragment[1]) is not None:
                    row["Overview"] = "\n".join(p for p in overview_parts if p)
                    row["Popularity"], row["Vote_Count"], row["Vote_Average"] = fragment[1:4]
                    row["Original_Language"], row["Genre"], row["Poster_Url"] = fragment[4:7]
                    fixed = True
                    j += 1
                    break
                j += 1
            if fixed:
                rows.append(row)
                repaired += 1
                i = j
                continue
            skipped += j - i
            i = j
            continue

        # Мусорная строка, которую не к чему приклеить
        skipped += 1
        i += 1

    return rows, repaired, skipped


def build_movie(movie_id: int, row: dict) -> dict:
    """Преобразует строку CSV в объект фильма для movies.json."""
    genres = [g.strip() for g in (row.get("Genre") or "").split(",") if g.strip()]
    # Убираем дубли жанров внутри одного фильма, сохраняя порядок
    genres = list(dict.fromkeys(genres))
    poster = (row.get("Poster_Url") or "").strip() or (row.get("Working URL") or "").strip()
    if not poster.startswith("http"):
        poster = ""  # ПРЕДПОЛОЖЕНИЕ: без корректной ссылки сайт покажет заглушку
    return {
        "id": movie_id,
        "title": row["Title"].strip(),
        "overview": (row.get("Overview") or "").strip(),
        "release_date": parse_date(row["Release_Date"]),
        "popularity": round(to_float(row["Popularity"], 0.0), 3),
        "vote_count": to_int(row["Vote_Count"], 0),
        "vote_average": round(to_float(row["Vote_Average"], 0.0), 1),
        "language": (row.get("Original_Language") or "").strip().lower(),
        "genres": genres,
        "poster_url": poster,
    }


def main():
    csv_path = find_csv_path()
    rows, repaired, skipped = read_rows(csv_path)

    # id — порядковый номер; названия в датасете не уникальны (ремейки),
    # поэтому опираться на Title как на ключ нельзя.
    movies = [build_movie(i + 1, row) for i, row in enumerate(rows)]

    # Группируем фильмы по жанрам: фильм попадает в КАЖДЫЙ из своих жанров
    by_genre = {}
    for movie in movies:
        for genre in movie["genres"]:
            by_genre.setdefault(genre, []).append(movie)

    genres = []
    for name, items in by_genre.items():
        # Сортировка по популярности (убывание); при равенстве — по числу голосов
        top = sorted(items, key=lambda m: (-m["popularity"], -m["vote_count"]))[:TOP_N]
        genres.append({"name": name, "count": len(items), "top20": top})

    # Жанры упорядочены по количеству фильмов (самые большие — первыми)
    genres.sort(key=lambda g: (-g["count"], g["name"]))

    # Проверка гарантии: top20 отсортирован по Popularity desc
    for g in genres:
        pops = [m["popularity"] for m in g["top20"]]
        assert pops == sorted(pops, reverse=True), f"Нарушена сортировка в жанре {g['name']}"
        assert len(g["top20"]) == min(TOP_N, g["count"])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "movies.json", "w", encoding="utf-8") as f:
        json.dump(movies, f, ensure_ascii=False, separators=(",", ":"))
    with open(OUT_DIR / "genres.json", "w", encoding="utf-8") as f:
        json.dump(genres, f, ensure_ascii=False, separators=(",", ":"))

    # ---- Статистика ----
    no_genre = sum(1 for m in movies if not m["genres"])
    print("=" * 50)
    print(f"Источник:            {csv_path.name}")
    print(f"Фильмов загружено:   {len(movies)}")
    print(f"Починено записей:    {repaired}")
    print(f"Пропущено строк:     {skipped}")
    print(f"Фильмов без жанра:   {no_genre}")
    print(f"Жанров:              {len(genres)}")
    print("Топ-5 жанров по количеству фильмов:")
    for g in genres[:5]:
        print(f"  {g['name']:<18} {g['count']:>5}")
    print(f"Файлы записаны в:    {OUT_DIR}")
    print("=" * 50)


if __name__ == "__main__":
    main()
