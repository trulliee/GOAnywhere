@echo off
setlocal enabledelayedexpansion

REM --- Move into correct working directory ---
cd backend\model_serving\traffic_congestion

echo [%time%] 🔵 Building and pushing Docker image...
gcloud builds submit --tag asia-southeast1-docker.pkg.dev/goanywhere-c55c8/model-serving-repo/traffic-congestion-fastapi . || exit /b

cd ..\..\..

REM --- Upload the model to Vertex AI ---
echo [%time%] 🔵 Uploading Docker image as Vertex AI model...
FOR /F "tokens=*" %%i IN ('gcloud ai models upload ^
    --region=asia-southeast1 ^
    --display-name=traffic-congestion-container ^
    --container-image-uri=asia-southeast1-docker.pkg.dev/goanywhere-c55c8/model-serving-repo/traffic-congestion-fastapi ^
    --container-predict-route=/predict ^
    --container-health-route=/ping ^
    --container-port=8080 ^
    --format="value(name)"') DO (
    set MODEL_UPLOAD_OUTPUT=%%i
)

echo [%time%] ✅ Model uploaded. Model ID is: !MODEL_UPLOAD_OUTPUT!

REM --- Check if endpoint exists ---
set ENDPOINT_NAME=traffic-congestion-endpoint

echo [%time%] 🔵 Checking for existing endpoint: %ENDPOINT_NAME%
FOR /F "tokens=*" %%e IN ('gcloud ai endpoints list ^
    --region=asia-southeast1 ^
    --filter="displayName=%ENDPOINT_NAME%" ^
    --format="value(name)"') DO (
    set ENDPOINT_ID=%%e
)

IF NOT DEFINED ENDPOINT_ID (
    echo [%time%] 🔵 No existing endpoint found. Creating new endpoint...
    FOR /F "tokens=*" %%e IN ('gcloud ai endpoints create ^
        --region=asia-southeast1 ^
        --display-name=%ENDPOINT_NAME% ^
        --format="value(name)"') DO (
        set ENDPOINT_ID=%%e
    )
)

echo [%time%] ✅ Endpoint ready: !ENDPOINT_ID!

REM --- Deploy the model to endpoint ---
echo [%time%] 🔵 Deploying model to endpoint...
gcloud ai endpoints deploy-model !ENDPOINT_ID! ^
    --region=asia-southeast1 ^
    --model=!MODEL_UPLOAD_OUTPUT! ^
    --display-name=traffic-congestion-deployment ^
    --machine-type=n1-standard-4 ^
    --traffic-split=0=100

echo [%time%] ✅ Deployment complete!

pause
