# MathGraph

Интерактивный граф знаний по математике для подготовки к ЕГЭ и олимпиадам.

**Стек:** Next.js 16 · NestJS 11 · PostgreSQL · Neo4j · Redis · Prisma · ReactFlow

---

## Содержание

- [Архитектура](#архитектура)
- [Быстрый старт](#быстрый-старт)
- [Переменные окружения](#переменные-окружения)
- [Структура проекта](#структура-проекта)
- [API](#api)
- [Модели данных](#модели-данных)
- [Граф Neo4j](#граф-neo4j)
- [Фичи](#фичи)
- [Деплой](#деплой)

---

## Архитектура

```
monorepo (npm workspaces)
├── apps/api      — NestJS бэкенд
├── apps/web      — Next.js фронтенд
└── libs/shared   — общие типы (TypeScript)
```

**Хранилища:**

| Хранилище | Назначение |
|-----------|-----------|
| PostgreSQL | Пользователи, узлы графа, прогресс, заметки, квизы, версии |
| Neo4j | Граф связей: `CONTAINS`, `PREREQ_REQUIRED` |
| Redis | Кэш топик-страниц, rate-limit |

---

## Быстрый старт

### 1. Зависимости

```bash
npm install
```

### 2. Инфраструктура (Docker)

```bash
docker-compose up -d
```

Запускает: PostgreSQL (порт 5433), Neo4j (7474/7687), Redis (6379).

### 3. Переменные окружения

```bash
cp apps/api/.env.example apps/api/.env
# Отредактируйте значения (см. раздел ниже)

# Фронтенд
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > apps/web/.env.local
```

### 4. Миграции и сид

```bash
cd apps/api
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

Сид создаёт: 26 топиков, 170+ узлов, 250+ рёбер, 10 квиз-вопросов, admin-аккаунт.

**Admin по умолчанию:** `al.zar.evg13@gmail.com` / `admin123`

### 5. Запуск

```bash
# API (порт 3001)


npm run dev:api

# Фронтенд (порт 3000)
npm run dev:web
```

### 6. Тесты

```bash
npm run test:web   # Vitest (фронтенд)
npm run test:api   # Jest (бэкенд)
```

---

## Переменные окружения

### `apps/api/.env`

```env
PORT=3001

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/mathgraph?schema=public

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=testtest1

# Redis (формат: redis://:пароль@хост:порт)
REDIS_URL=redis://:redis@localhost:6379

# JWT
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# LLM (OpenRouter / DeepSeek / любой OpenAI-совместимый)
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://openrouter.ai/api/v1
DEEPSEEK_MODEL=nvidia/nemotron-3-super-120b-a12b:free
```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Структура проекта

```
apps/api/src/
├── auth/           — регистрация, логин, JWT, роли (USER / COMPOSER / ADMIN)
├── knowledge/      — CRUD узлов графа, экспорт/импорт JSON
├── topic-page/     — сборка топик-страницы (узлы + слоты)
├── topics/         — список топиков
├── neo4j/          — Neo4j сервис (prereq subgraph, topic subgraph)
├── progress/       — прогресс пользователя по узлам
├── analytics/      — heatmap активности, статистика по ролям
├── versioning/     — история версий узлов, откат
├── search/         — Postgres FTS + ILIKE fallback
├── notes/          — личные заметки к узлам (markdown)
├── quiz/           — вопросы и попытки ответов
├── route/          — AI-маршрут обучения (Neo4j + LLM)
├── assistant/      — AI-чат (сессии, история)
├── study-plan/     — план изучения
├── roadmap/        — roadmap страница
├── redis/          — кэш-сервис
└── prisma/         — Prisma сервис

apps/web/src/
├── app/            — Next.js страницы
│   ├── /           — Главная (список топиков)
│   ├── /topic/[id] — Граф топика
│   ├── /profile    — Личный кабинет
│   ├── /analytics  — Дашборд аналитики
│   ├── /presets    — Учебные треки (ЕГЭ / Олимпиады)
│   ├── /route      — AI-маршрут обучения
│   ├── /roadmap    — Дорожная карта тем
│   ├── /editor     — Редактор графа (COMPOSER / ADMIN)
│   ├── /admin      — Панель администратора
│   └── /auth       — Авторизация
├── components/
│   └── Navbar.tsx  — Единый навбар (desktop + mobile bottom nav)
├── features/
│   ├── graph-view/ — ReactFlow граф (KgNode, RowLabel, MobileGraphList)
│   ├── topic-page/ — Лейаут топик-страницы + bottom sheet панель
│   ├── notes/      — Редактор заметок с markdown-превью
│   ├── quiz/       — Панель квиза (MC + text input)
│   ├── editor/     — LaTeX WYSIWYG (MathLive)
│   ├── search/     — Глобальный поиск с клавиатурной навигацией
│   └── assistant/  — AI-чат кнопка и панель
├── lib/            — API-клиенты (authApi, progressApi, quizApi, ...)
├── hooks/          — useMobileDetect, useSwipeDown, useGraphKeyboardNav
└── providers/      — ThemeProvider, AuthProvider
```

---

## API

Swagger UI доступен по адресу: `http://localhost:3001/api`

### Основные эндпоинты

#### Auth
| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/auth/register` | Регистрация |
| `POST` | `/auth/login` | Вход, возвращает `accessToken` + `refreshToken` |
| `POST` | `/auth/refresh` | Обновление access-токена |
| `GET` | `/auth/profile` | Профиль текущего пользователя |
| `PATCH` | `/auth/profile` | Обновить имя пользователя |

#### Граф знаний
| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/knowledge/nodes` | Список всех узлов |
| `POST` | `/knowledge/nodes` | Создать узел |
| `PATCH` | `/knowledge/nodes/:id` | Обновить узел |
| `DELETE` | `/knowledge/nodes/:id` | Удалить узел |
| `POST` | `/knowledge/edges` | Создать ребро |
| `DELETE` | `/knowledge/edges` | Удалить ребро |
| `GET` | `/knowledge/export` | Экспорт всего графа (JSON) |
| `POST` | `/knowledge/import` | Импорт графа (JSON) |

#### Топик-страница
| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/topic/:id/page?track=school&depth=1` | Данные для страницы топика |

#### Прогресс
| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/progress/toggle/:nodeId` | Переключить статус узла |
| `GET` | `/progress/topic?nodeIds=...` | Прогресс по набору узлов |
| `GET` | `/progress/summary` | Прогресс по всем топикам |

#### Квиз
| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/quiz/:nodeId` | Вопросы для узла (без ответов) |
| `POST` | `/quiz/answer` | Отправить ответ → `{ correct, correctAnswer, explanation }` |
| `GET` | `/quiz/:nodeId/stats` | Статистика попыток пользователя |
| `POST` | `/quiz/:nodeId` | Создать вопрос (ADMIN) |

#### AI
| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/route` | Построить AI-маршрут обучения по цели |
| `POST` | `/assistant/ask` | Разовый вопрос AI-ассистенту |
| `POST` | `/assistant/sessions` | Создать чат-сессию |
| `POST` | `/assistant/sessions/:id/message` | Отправить сообщение в сессию |

#### Поиск и прочее
| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/search?q=...&limit=20` | Полнотекстовый поиск узлов |
| `GET` | `/notes/:nodeId` | Заметка пользователя к узлу |
| `PUT` | `/notes/:nodeId` | Сохранить заметку |
| `GET` | `/analytics/summary` | Сводная статистика |
| `GET` | `/analytics/activity` | Активность за 90 дней |

---

## Модели данных

### Prisma (PostgreSQL)

```prisma
model KgNodeRegistry {
  id          String   — UUID
  title       String
  role        TopicNodeRole  — TOPIC | CONCEPT | METHOD | SKILL | TASK
  description String?
  content     String?
  resources   String[]
  fipiCode    String?
  status      NodeStatus     — DRAFT | PUBLISHED | ARCHIVED
}

model User {
  id           String
  email        String   @unique
  name         String?
  role         UserRole — USER | COMPOSER | ADMIN
  passwordHash String
}

model NodeProgress   — userId + nodeId + completed + completedAt
model NodeNote       — userId + nodeId + content (markdown)
model NodeQuestion   — nodeId + type (MC/TEXT) + question + options + answer
model QuizAttempt    — userId + questionId + answer + correct
model KgNodeVersion  — nodeId + version + snapshot полей
model ChatSession    — userId + messages (JSON) + topicId
```

### Роли узлов

| Роль | Цвет | Назначение |
|------|------|-----------|
| TOPIC | синий | Тема верхнего уровня |
| CONCEPT | фиолетовый | Понятие / определение |
| METHOD | оранжевый | Способ решения |
| SKILL | зелёный | Практический навык |
| TASK | красный | Задача / упражнение |

---

## Граф Neo4j

### Типы рёбер

| Тип | Направление | Смысл |
|-----|------------|-------|
| `CONTAINS` | Topic → Node | Топик содержит узел |
| `PREREQ_REQUIRED` | Node → Node | Узел A нужен перед узлом B |

### Пример запроса — цепочка пререквизитов

```cypher
MATCH path = (prereq:KGNode)-[:PREREQ_REQUIRED*0..6]->(target:KGNode {id: $topicId})
WHERE prereq.role = 'TOPIC'
WITH prereq, min(length(path)) AS dist
RETURN prereq.id AS id, prereq.title AS title, dist
ORDER BY dist DESC
```

---

## Фичи

### Граф топика
- **Режимы отображения:** Обзор / Фокус / Путь / Зависимости
- **Режим зависимостей:** BFS по `PREREQ_REQUIRED` — подсвечивает что нужно знать перед выбранным узлом
- **Адаптивная ширина узлов** — рассчитывается по длине заголовка
- **Row-labels** — виртуальные узлы-разделители строк в ReactFlow
- **Мобильная версия** — список с аккордеонами вместо графа

### Боковая панель
- Desktop: выезжает справа
- Mobile: bottom sheet с drag handle + свайп вниз для закрытия
- Содержит: детали узла, прогресс, видео-эмбед, markdown-заметку, квиз

### Видео-ссылки
Автодетект URL в поле `resources`:
- **YouTube** — thumbnail превью → iframe с autoplay
- **VK / vkvideo.ru** — цветная карточка → iframe
- **Rutube** — карточка → iframe

### LaTeX редактор
В редакторе узлов кнопка **∑ формула** открывает модалку:
- MathLive WYSIWYG-редактор
- 24 кнопки быстрой вставки
- Live KaTeX-превью
- Вставка в текст на позицию курсора (`$...$` или `$$...$$`)

### AI-маршрут обучения (`/route`)
1. Пользователь вводит цель: _"хочу понять логарифмы"_
2. FTS-поиск → матч с топиком в Postgres
3. BFS по `PREREQ_REQUIRED` в Neo4j → цепочка тем
4. LLM генерирует объяснение каждого шага и вступление
5. Timeline с кнопками "Открыть →" для каждой темы

### CSV-импорт
В редакторе: **↑ Импорт CSV** — поддерживает запятую и точку с запятой.

Формат:
```csv
title,role,description,content,fipiCode,resources
Теорема Пифагора,CONCEPT,Квадрат гипотенузы...,,,
```

### Учебные треки (`/presets`)
| Трек | Тем | Аудитория |
|------|-----|-----------|
| ЕГЭ База | 10 | Базовый уровень |
| ЕГЭ Профиль | 24 | Профильный уровень |
| Олимпиады | 12 | Математические олимпиады |

Прогресс-кольцо на основе `progress/summary`.

---

## Деплой

### Бесплатный стек

| Сервис | Назначение | Лимит free tier |
|--------|-----------|-----------------|
| [Vercel](https://vercel.com) | Next.js фронтенд | Без лимита |
| [Railway](https://railway.app) | NestJS API | 500 часов/мес |
| [Neon](https://neon.tech) | PostgreSQL | 0.5 GB |
| [Neo4j Aura Free](https://neo4j.com/cloud/aura-free/) | Neo4j | 200 MB, 1 инстанс |
| [Upstash](https://upstash.com) | Redis | 10K команд/день |

### Переменные для production

В Railway/Vercel установить:
```
DATABASE_URL=          # Neon connection string
NEO4J_URI=             # Neo4j Aura bolt URL
NEO4J_USER=neo4j
NEO4J_PASSWORD=        # Aura password
REDIS_URL=             # Upstash redis URL (с паролем)
JWT_SECRET=            # случайная строка 64+ символов
DEEPSEEK_API_KEY=      # ключ LLM-провайдера
DEEPSEEK_BASE_URL=
DEEPSEEK_MODEL=
```

### Порядок деплоя

1. Создать инстансы в Neon, Neo4j Aura, Upstash
2. Запустить миграции: `npx prisma migrate deploy`
3. Запустить сид: `npx tsx prisma/seed.ts`
4. Задеплоить API на Railway (`apps/api`)
5. Задеплоить фронтенд на Vercel (`apps/web`)
6. Установить `NEXT_PUBLIC_API_URL` в Vercel → URL Railway-инстанса
7. Настроить CORS в API: разрешить домен Vercel

> **Важно:** Railway усыпляет инстанс после 30 минут неактивности. Для production рекомендуется платный план или холодный старт через `/health` endpoint.

---

## Разработка

### Генерация Prisma-клиента после изменения схемы

```bash
cd apps/api
npx prisma migrate dev --name <название>
npx prisma generate
```

### Запуск сида заново (idempotent)

```bash
cd apps/api
npx tsx prisma/seed.ts
```

### Добавить квиз-вопрос через API

```bash
curl -X POST http://localhost:3001/quiz/<nodeId> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MULTIPLE_CHOICE",
    "question": "Чему равен дискриминант?",
    "options": ["b²-4ac", "b²+4ac", "-b/2a"],
    "answer": "b²-4ac",
    "explanation": "D = b² - 4ac"
  }'
```
