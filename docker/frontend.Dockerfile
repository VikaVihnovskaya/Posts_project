# Базовый образ: лёгкий Node.js (Alpine Linux)
FROM node:20-alpine

# Рабочая директория внутри контейнера
WORKDIR /app

# Сначала копируем package.json и package-lock.json
# Это позволяет кэшировать слой установки зависимостей
COPY FrontEnd/package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь фронтенд-код
COPY FrontEnd/ ./

# Открываем порт для Vite (по умолчанию 5173)
EXPOSE 5173

# Запускаем dev-сервер Vite с hot-reload и доступом снаружи
CMD ["npm", "run", "dev", "--", "--host"]