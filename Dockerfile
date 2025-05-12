FROM python:3.9-slim

WORKDIR /app

COPY backend/requirements3-9-0.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY backend /app/

# Set environment variable for port
ENV PORT=8080
# ENV GOOGLE_APPLICATION_CREDENTIALS="/app/service-account-key.json"
# ENV USE_LOCAL_FIREBASE_CREDENTIALS=1
# ENV FIREBASE_CREDENTIALS_PATH="/app/service-account-key.json"
ENV GCP_PROJECT_ID=goanywhere-c55c8

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
