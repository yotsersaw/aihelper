# AI Website Chat Widget MVP (Multi-tenant SaaS)

Рабочий MVP SaaS-сервиса для AI-чата на сайтах клиентов.

## Что умеет

- Multi-tenant боты (`public_bot_id`) с отдельными настройками.
- Script embed для сайтов клиентов: `<script src="https://YOUR_DOMAIN/widget.js" data-bot-id="demo-dental"></script>`.
- Серверный proxy к OpenRouter (ключ только на сервере).
- Проверка `allowed_domain`, активность бота, лимиты токенов и стоимости.
- Хранение conversations/messages/leads/usage в Supabase.
- Demo страница `/demo/[botId]`.
- Простая защищённая admin-зона `/admin` через `ADMIN_SECRET`.

## Стек

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Postgres)
- OpenRouter API
- Vercel

## Быстрый старт в GitHub Codespaces

1. Создайте новый GitHub repository и загрузите в него файлы этого проекта.
2. Нажмите **Code → Codespaces → Create codespace on main**.
3. Дождитесь выполнения `postCreateCommand` (`npm install`).
4. Скопируйте `.env.example` в `.env.local` и заполните значения.
5. Запустите:
   ```bash
   npm run dev
   ```
6. Откройте forwarded порт `3000`.

## Локальный запуск

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Настройка Supabase

1. Создайте новый проект на https://supabase.com.
2. Откройте **SQL Editor**.
3. Вставьте содержимое `supabase/schema.sql` и выполните.
4. В таблице `bots` уже создастся демо-бот `demo-dental`.

## Как применить SQL schema

- Файл: `supabase/schema.sql`.
- В нём есть:
  - таблицы `bots`, `conversations`, `messages`, `leads`, `usage_daily`;
  - индексы;
  - триггеры `updated_at`;
  - SQL функцию `upsert_usage_daily`;
  - seed демо-бота.

## OpenRouter API key

1. Создайте аккаунт на https://openrouter.ai.
2. Перейдите в раздел API Keys.
3. Создайте ключ.
4. Укажите его в `.env.local` как `OPENROUTER_API_KEY`.

## Заполнение `.env.local`

Пример:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
ADMIN_SECRET=VERY_STRONG_PASSWORD
```

### Публичные переменные

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

### Серверные (секретные)

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`
- `ADMIN_SECRET`

## Deploy на Vercel

1. Импортируйте GitHub repo в Vercel.
2. Framework: `Next.js` определится автоматически.
3. Добавьте все переменные окружения из `.env.example` в **Project Settings → Environment Variables**.
4. Нажмите Deploy.
5. После деплоя задайте `NEXT_PUBLIC_APP_URL` равным вашему production домену, сделайте redeploy.

## Как вставить widget на сайт клиента

Добавьте на сайт клиента:

```html
<script src="https://YOUR_DOMAIN/widget.js" data-bot-id="demo-dental"></script>
```

- `YOUR_DOMAIN` — домен вашего Vercel приложения.
- `data-bot-id` — `public_bot_id` конкретного клиента.

## Как протестировать demo bot

- Откройте `/demo/demo-dental`.
- Можно писать в чат и отправлять форму лида.

## Как зайти в admin

1. Откройте `/admin/login`.
2. Введите `ADMIN_SECRET`.
3. После входа доступно:
   - создание ботов,
   - редактирование базовых полей,
   - просмотр leads,
   - просмотр conversations,
   - просмотр usage summary.

## Важные маршруты

- `GET /widget.js` — embed-скрипт.
- `GET /widget/[botId]` — iframe чат-виджета.
- `POST /api/chat` — OpenRouter proxy + логирование + лимиты.
- `POST /api/leads` — сохранение лидов.
- `/admin` — внутренняя панель.

## Пошагово с нуля

1. **Создать GitHub repo** и загрузить код.
2. **Открыть в Codespaces** или локально.
3. **Создать Supabase project**.
4. **Выполнить `supabase/schema.sql`** в SQL Editor.
5. **Заполнить `.env.local`**.
6. **Проверить `npm run dev`**.
7. **Задеплоить на Vercel**, добавить env.
8. **Проверить `/demo/demo-dental`**.
9. **Вставить script tag** на клиентский сайт.
10. **Создавать и управлять bot-ами через `/admin`**.
