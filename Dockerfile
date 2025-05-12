FROM python:3.9-slim

WORKDIR /app

COPY backend/requirements3-9-0.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

<<<<<<< HEAD
# Copy the application code
COPY backend /app/

# Set environment variable for port
=======
COPY backend/app /app/app

EXPOSE 8080

>>>>>>> 0d9375f6fc8a9b441e0c7bfc872f24a0cfe45df1
ENV PORT=8080
# ENV GOOGLE_APPLICATION_CREDENTIALS="/app/service-account-key.json"
# ENV USE_LOCAL_FIREBASE_CREDENTIALS=1
# ENV FIREBASE_CREDENTIALS_PATH="/app/service-account-key.json"
ENV GCP_PROJECT_ID=goanywhere-c55c8

<<<<<<< HEAD
# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
=======
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
>>>>>>> 0d9375f6fc8a9b441e0c7bfc872f24a0cfe45df1
