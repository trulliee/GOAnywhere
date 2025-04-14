@echo off
echo  Building Docker image...
docker build --no-cache -t trolley124/goanywhere-backend:latest .

IF %ERRORLEVEL% NEQ 0 (
  echo Docker build failed. Aborting.
  exit /b %ERRORLEVEL%
)

echo Pushing image to Docker Hub...
docker push trolley124/goanywhere-backend:latest

IF %ERRORLEVEL% NEQ 0 (
  echo Docker push failed. Aborting.
  exit /b %ERRORLEVEL%
)

echo Deploying to Cloud Run...
gcloud run deploy goanywhere-backend ^
  --image=trolley124/goanywhere-backend:latest ^
  --platform=managed ^
  --region=asia-southeast1 ^
  --project=goanywhere-c55c8 ^
  --allow-unauthenticated

IF %ERRORLEVEL% EQU 0 (
  echo Successfully deployed to Cloud Run!
) ELSE (
  echo Deployment failed.
)
