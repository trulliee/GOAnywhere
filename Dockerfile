# Use a slim Python base image
FROM python:3.9-slim

<<<<<<< HEAD
# Set the working directory inside the container
=======
>>>>>>> d12bfdaca4ce5ab90a4001023a6f97f946707008
WORKDIR /app

# Copy only the requirements first to leverage Docker caching
COPY backend/requirements3-12-7.txt ./requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

<<<<<<< HEAD
# Now copy the full app source code
COPY backend/app /app/app

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Set environment variables needed by your app
=======
# Copy the application code
COPY backend /app/

# Set environment variable for port
>>>>>>> d12bfdaca4ce5ab90a4001023a6f97f946707008
ENV PORT=8080

<<<<<<< HEAD
# Command to run your FastAPI app using Python's -m option
# CMD ["python", "-m", "app.main"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
=======
# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
>>>>>>> d12bfdaca4ce5ab90a4001023a6f97f946707008
