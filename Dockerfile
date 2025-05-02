# Use a slim Python base image
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Copy only the requirements first to leverage Docker caching
COPY backend/requirements3-10-0.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the full app source code
COPY backend/app /app/app

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Set environment variables needed by your app
ENV PORT=8080
ENV GMAPS_API_KEY=AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g
ENV GCP_PROJECT_ID=goanywhere-c55c8

# Command to run your FastAPI app using Python's -m option
CMD ["python", "-m", "app.main"]