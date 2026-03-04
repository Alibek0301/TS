# 🚗 TransferSchedule — График трансферов

Система управления расписанием трансферов с защитой от конфликтов назначения.

## 🧱 Технологический стек

| Слой | Технология |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Node.js + Express + TypeScript |
| База данных | PostgreSQL 16 |
| ORM | Prisma |
| Авторизация | JWT |
| UI | Кастомный CSS (dashboard-стиль) |
| Календарь | react-big-calendar |

## 🗂 Структура проекта

```
TS/
├── backend/                 # Node.js + Express API
│   ├── prisma/
│   │   ├── schema.prisma    # Схема БД
│   │   └── seed.ts          # Начальные данные
│   ├── src/
│   │   ├── controllers/     # Логика обработки запросов
│   │   ├── middleware/      # Auth middleware
│   │   ├── routes/          # Маршруты API
│   │   └── utils/           # Prisma client, conflict checker
│   └── package.json
│
├── frontend/                # React SPA
│   ├── src/
│   │   ├── api/             # HTTP клиент (axios)
│   │   ├── components/      # UI компоненты
│   │   │   ├── Cars/
│   │   │   ├── Drivers/
│   │   │   ├── Layout/
│   │   │   └── Transfers/
│   │   ├── context/         # AuthContext
│   │   ├── pages/           # Страницы приложения
│   │   ├── types/           # TypeScript интерфейсы
│   │   └── utils/           # Вспомогательные функции
│   └── package.json
│
├── docker-compose.yml       # Docker конфигурация
└── README.md
```

## 🗄 Схема базы данных

### Drivers (Водители)
| Поле | Тип | Описание |
|------|-----|----------|
| id | Int | PK |
| fullName | String | ФИО |
| phone | String | Телефон |
| status | Enum | ACTIVE / DAY_OFF / VACATION |
| note | String? | Примечание |

### Cars (Автомобили)
| Поле | Тип | Описание |
|------|-----|----------|
| id | Int | PK |
| brand | String | Марка |
| model | String | Модель |
| plateNumber | String | Госномер (уникальный) |
| status | Enum | FREE / MAINTENANCE / BUSY |

### Transfers (Трансферы)
| Поле | Тип | Описание |
|------|-----|----------|
| id | Int | PK |
| date | Date | Дата трансфера |
| startTime | DateTime | Время начала |
| endTime | DateTime | Время окончания |
| origin | String | Точка отправления |
| destination | String | Точка назначения |
| driverId | Int | FK → Drivers |
| carId | Int | FK → Cars |
| status | Enum | PLANNED / COMPLETED / CANCELLED |
| comment | String? | Комментарий |

### TransferHistory (История изменений)
| Поле | Тип | Описание |
|------|-----|----------|
| id | Int | PK |
| transferId | Int | FK → Transfers |
| userId | Int | FK → Users |
| action | String | CREATE / UPDATE |
| description | String | Описание изменения |

## ⚠️ Логика защиты от конфликтов

При создании или редактировании трансфера система проверяет:

```
Конфликт: newStart < existingEnd AND newEnd > existingStart
```

- Нельзя назначить водителя, если у него есть пересекающийся трансфер
- Нельзя назначить автомобиль, который занят в указанное время
- Отменённые трансферы не учитываются при проверке конфликтов

**Сообщения об ошибках:**
```
"Конфликт расписания: водитель уже назначен на трансфер в это время"
"Автомобиль занят в указанное время"
```

## 🔐 Роли и права доступа

| Действие | Администратор | Диспетчер | Водитель |
|----------|:---:|:---:|:---:|
| Просмотр всех трансферов | ✅ | ✅ | ❌ (только свои) |
| Создание трансфера | ✅ | ✅ | ❌ |
| Редактирование трансфера | ✅ | ✅ | ❌ |
| Удаление трансфера | ✅ | ❌ | ❌ |
| Управление водителями | ✅ | ✅ | ❌ |
| Управление автомобилями | ✅ | ✅ | ❌ |
| Удаление водителей/авто | ✅ | ❌ | ❌ |

## 📡 REST API

### Auth
```
POST   /api/auth/login       Вход
GET    /api/auth/me          Текущий пользователь
```

### Drivers
```
GET    /api/drivers          Список водителей
GET    /api/drivers/:id      Водитель по ID
POST   /api/drivers          Создать водителя
PUT    /api/drivers/:id      Обновить водителя
DELETE /api/drivers/:id      Удалить водителя
```

Доступ:
- `ADMIN`, `DISPATCHER`: чтение/создание/обновление
- `ADMIN`: удаление

### Cars
```
GET    /api/cars             Список автомобилей
GET    /api/cars/:id         Автомобиль по ID
POST   /api/cars             Создать автомобиль
PUT    /api/cars/:id         Обновить автомобиль
DELETE /api/cars/:id         Удалить автомобиль
```

Доступ:
- `ADMIN`, `DISPATCHER`: чтение/создание/обновление
- `ADMIN`: удаление

### Transfers
```
GET    /api/transfers        Список трансферов (с фильтрами)
GET    /api/transfers/:id    Трансфер по ID (с историей)
GET    /api/transfers/history/recent Журнал последних изменений (ADMIN/DISPATCHER)
PATCH  /api/transfers/:id/my-status Водитель: смена статуса своего трансфера
POST   /api/transfers        Создать трансфер (проверка конфликтов)
PUT    /api/transfers/:id    Обновить трансфер (проверка конфликтов)
DELETE /api/transfers/:id    Удалить трансфер
```

Для `PATCH /api/transfers/:id/my-status` доступны только статусы:
- `COMPLETED`
- `CANCELLED`

**Фильтры для GET /api/transfers:**
- `?driverId=1` — по водителю
- `?carId=1` — по автомобилю
- `?date=2024-01-15` — по дате
- `?startDate=2024-01-01&endDate=2024-01-31` — диапазон дат
- `?status=PLANNED` — по статусу

### Dashboard
```
GET    /api/dashboard        Статистика для главной страницы
```

Доступ:
- `ADMIN`, `DISPATCHER`: общий дашборд
- `DRIVER`: персональный дашборд (собственные показатели и ближайшие рейсы)

### Users (Admin)
```
GET    /api/users            Список пользователей
POST   /api/users            Создать пользователя
PUT    /api/users/:id        Обновить пользователя
DELETE /api/users/:id        Удалить пользователя
```

Доступ: только `ADMIN`

## 🚀 Инструкция по запуску

### Способ 1: Docker Compose (рекомендуется)

```bash
# Клонируйте репозиторий
git clone https://github.com/Alibek0301/TS.git
cd TS

# Запустите все сервисы
docker-compose up -d

# Применить миграции и создать тестовые данные
docker-compose exec backend npx prisma migrate dev --name init
docker-compose exec backend npx ts-node prisma/seed.ts
```

Откройте http://localhost:5173

### Способ 2: Локальная разработка

#### Требования
- Node.js 18+
- PostgreSQL 14+

#### Backend

```bash
cd backend

# Установить зависимости
npm install

# Создать .env файл
cp .env.example .env
# Отредактируйте DATABASE_URL в .env

# Применить миграции
npx prisma migrate dev --name init

# Создать тестовые данные
npx ts-node prisma/seed.ts

# Запустить сервер разработки
npm run dev
```

Backend будет доступен на http://localhost:3001

#### Frontend

```bash
cd frontend

# Установить зависимости
npm install

# Запустить
npm run dev
```

Frontend будет доступен на http://localhost:5173

## 🔑 Тестовые аккаунты

После запуска seed будут доступны следующие аккаунты:

| Роль | Email | Пароль |
|------|-------|--------|
| Администратор | vip.transfer.astana@gmail.com | Aa123456 |
| Диспетчер | dispatcher@transfer.com | dispatcher123 |
| Водитель | driver@transfer.com | driver123 |

## 📊 Возможности системы

### Дашборд
- Количество трансферов на сегодня
- Свободные / занятые автомобили
- Водители на смене
- Ближайшие 5 трансферов
- KPI по смене: доля выполненных, доля отмен, средняя длительность рейса, просроченные плановые рейсы

### График трансферов
- **Табличный вид** — все трансферы с фильтрацией
- **Календарный вид** — визуализация по неделям/дням
- Цветовая индикация: Запланирован (синий), Выполнен (зелёный), Отменён (красный)

### Режим водителя
- Персональный дашборд с собственной статистикой за день
- Страница **«Мои смены»** с быстрыми фильтрами: Сегодня / Эта неделя / Выполненные / Все
- Быстрое изменение статуса своего запланированного рейса: `COMPLETED` или `CANCELLED`
- Экспорт списка смен в CSV

### Режим диспетчера/администратора
- Страница **«Оперативная смена»** с рейсами за сегодня
- Быстрые фильтры и поиск по маршруту/водителю/авто
- Массовое закрытие запланированных рейсов и быстрые действия по каждому рейсу
- Журнал действий с фильтрами (дата/действие/пользователь/ID рейса) и экспортом CSV

## 🌐 Production деплой (Docker)

Подходит для VPS/сервера с Docker и Docker Compose.

### 1) Подготовка переменных

```bash
cp .env.prod.example .env.prod
```

Заполните минимум:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `FRONTEND_URL` (например, `https://your-domain.com`)

### 2) Сборка и запуск

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### 3) Проверка

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
curl http://localhost/api/health
```

### 4) Обновление приложения

```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### Примечания
- PostgreSQL хранит данные в Docker volume `postgres_data`.
- Backend при старте применяет миграции Prisma (`migrate deploy`), а если папка миграций отсутствует — выполняет `db push`.
- Внешний порт открыт только у frontend (`APP_PORT`, по умолчанию 80).

### Управление
- Быстрое создание трансфера через модальное окно
- Автоматическое заполнение времени окончания (+2 часа по умолчанию)
- История изменений каждого трансфера
- Фильтрация по водителю, автомобилю, дате, статусу
