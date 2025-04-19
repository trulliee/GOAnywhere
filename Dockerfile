FROM python:3.9-slim

# Set the working directory
WORKDIR /app

# Copy requirements file
COPY backend/requirements3-12-7.txt ./requirements.txt

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/app /app/app

# Create directory for trained models
RUN mkdir -p /app/app/models/trained

# Set environment variables
ENV PORT=8080
ENV GMAPS_API_KEY=AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g
ENV GCP_PROJECT_ID=goanywhere-c55c8

# Command to run the FastAPI app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]