FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc libpq-dev curl gnupg \
    && curl -fsSL https://get.docker.com | sh \
    && curl -fsSL https://github.com/grafana/k6/releases/download/v0.49.0/k6-v0.49.0-linux-amd64.tar.gz | tar -xz \
    && mv k6-v0.49.0-linux-amd64/k6 /usr/local/bin/k6 \
    && rm -rf k6-v0.49.0-linux-amd64 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]