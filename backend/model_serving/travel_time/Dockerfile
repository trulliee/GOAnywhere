FROM python:3.9-slim

WORKDIR /app

# Inject model version at build time
ARG MODEL_VERSION=v1
ENV MODEL_VERSION=${MODEL_VERSION}

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

EXPOSE 8080

CMD ["uvicorn", "model_server:app", "--host", "0.0.0.0", "--port", "8080"]
