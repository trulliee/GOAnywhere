@echo off
set CONTAINER_NAME=goanywhere-backend-container

echo Stopping old container (if it exists)...
docker stop %CONTAINER_NAME% >nul 2>&1
docker rm %CONTAINER_NAME% >nul 2>&1

echo Rebuilding Docker image...
docker build -t goanywhere-backend .

echo Running backend locally with Docker...
docker run -p 8000:8000 ^
  -e USE_LOCAL_FIREBASE_CREDENTIALS=1 ^
  -e FIREBASE_CREDENTIALS_PATH=/app/service-account-key.json ^
  -v "C:/Users/kaung/Desktop/GOAnywhere/backend/storage/service-account-key.json:/app/service-account-key.json" ^
  goanywhere-backend
