# Use a slim Python base image
FROM python:3.9-slim

WORKDIR /app

# Copy only the requirements first to leverage Docker caching
COPY backend/requirements3-9-0.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY backend /app/

# Set environment variable for port
ENV PORT=8080
ENV GMAPS_API_KEY=AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g
ENV GCP_PROJECT_ID=goanywhere-c55c8

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
