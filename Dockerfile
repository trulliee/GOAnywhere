FROM python:3.9-slim

# Set the working directory
WORKDIR /app

# Copy requirements file
COPY backend/requirements3-12-7.txt ./requirements.txt

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the app folder to ensure correct structure
COPY backend/app /app/app

# Copy the Firebase service account JSON
COPY backend/app/service-account-key.json /app/service-account-key.json
ENV FIREBASE_SERVICE_ACCOUNT=/app/service-account-key.json

# Set environment variables
ENV PORT=8080
ENV GMAPS_API_KEY=AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g

# 🔍 TEMP DEBUG: Show contents of /app/app/routes
RUN echo "Routes directory content:" && ls /app/app/routes

# Command to run the FastAPI app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
