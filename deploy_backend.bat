@echo off
setlocal enabledelayedexpansion

echo.
echo Cleaning up unused Docker images to save space...
docker image prune -f

echo.
echo Building Docker image with cache enabled...
docker build -t trolley124/goanywhere-backend:latest .

IF %ERRORLEVEL% NEQ 0 (
  echo ❌ Docker build failed. Aborting.
  exit /b %ERRORLEVEL%
)

echo.
echo Pushing image to Docker Hub...
docker push trolley124/goanywhere-backend:latest

IF %ERRORLEVEL% NEQ 0 (
  echo ❌ Docker push failed. Aborting.
  exit /b %ERRORLEVEL%
)

:: Sanitize time (remove colons and periods)
set CLEAN_TIME=%TIME::=%
set CLEAN_TIME=%CLEAN_TIME:.=%
set FORCE_DEPLOY_TIMESTAMP=%DATE%_%CLEAN_TIME%

echo.
echo Deploying to Cloud Run...
gcloud run deploy goanywhere-backend ^
  --image=trolley124/goanywhere-backend:latest ^
  --platform=managed ^
  --region=asia-southeast1 ^
  --set-env-vars=USE_LOCAL_FIREBASE_CREDENTIALS=0,GCP_PROJECT_ID=goanywhere-c55c8,FIREBASE_SECRET_NAME=firebase-service-account-key,GMAPS_API_KEY=AIzaSyDHIQoHjcVR0RsyKG-U5myMIpdPqK6n-m0,FORCE_DEPLOY_TIMESTAMP=%TIMESTAMP% ^
  --allow-unauthenticated

IF %ERRORLEVEL% EQU 0 (
  echo ✅ Successfully deployed to Cloud Run!
) ELSE (
  echo ❌ Deployment failed.
)

endlocal
