# Доступные сервисы
http://localhost:5173 → Vue (hot reload)

http://localhost:3000 → Node.js API (с nodemon)

http://localhost:27017 → MongoDB (CLI/driver)

http://localhost:8081 → Mongo Express GUI   (admin, pass)

http://localhost:9001 → MinIO Console (логин: minio / miniopass)



# Собрать образы и запустить контейнеры
sudo docker compose up -d --build

# Останавливает и удаляет все контейнеры. Но данные Mongo и MinIO сохранятся, потому что они в volumes
sudo docker compose down

# Полная остановка + очистка данных. Удалит контейнеры и volumes (данные Mongo и MinIO будут стерты)
docker-compose down -v