FROM python:3.9-slim

WORKDIR /app

# Copy requirements file
COPY backend/requirements3-12-7.txt ./requirements.txt

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY backend /app/

# Set environment variable for port
ENV PORT=8080

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]