FROM python:3.9-slim

WORKDIR /app

COPY backend/requirements3-9-0.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app /app/app

EXPOSE 8080

# Common environment variables
ENV PORT=8080
ENV GCP_PROJECT_ID=goanywhere-c55c8
ENV VERTEX_ENDPOINT_TRAFFIC=6098309302064250880
ENV VERTEX_ENDPOINT_TRAVEL_TIME=7332295599963766784
ENV REGION=asia-southeast1
ENV GCP_REGION=asia-southeast1
ENV USE_LOCAL_FIREBASE_CREDENTIALS=0
ENV FIREBASE_SECRET_NAME=firebase-service-account-key
ENV GMAPS_API_KEY=AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]