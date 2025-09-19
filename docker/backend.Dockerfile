# Базовый образ: Node.js (Alpine Linux)
FROM node:20-alpine

# Рабочая директория
WORKDIR /app

# Копируем файлы зависимостей
COPY BackEnd/package*.json ./

# Устанавливаем зависимости
RUN npm install

# Устанавливаем nodemon глобально для авто-перезапуска
RUN npm install -g nodemon

# Копируем backend-код
COPY BackEnd/ ./

# API обычно слушает порт 3000
EXPOSE 3000

# Запускаем backend через nodemon (следит за изменениями)
CMD ["nodemon", "index.js"]