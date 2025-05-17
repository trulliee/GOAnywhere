FROM python:3.9-slim

WORKDIR /app

COPY backend/requirements3-9-0.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY backend /app/

EXPOSE 8080

# Common environment variables
ENV PORT=8080
ENV GCP_PROJECT_ID=goanywhere-c55c8
ENV REGION=asia-southeast1
ENV GCP_REGION=asia-southeast1
ENV USE_LOCAL_FIREBASE_CREDENTIALS=0
ENV FIREBASE_SECRET_NAME=firebase-service-account-key
ENV GMAPS_API_KEY=AIzaSyDHIQoHjcVR0RsyKG-U5myMIpdPqK6n-m0

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]