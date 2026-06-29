FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    gnupg \
    libcairo2 \
    libcairo-gobject2 \
    libglib2.0-0 \
    libgdk-pixbuf-2.0-0 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libharfbuzz0b \
    libharfbuzz-subset0 \
    libfribidi0 \
    libffi-dev \
    shared-mime-info \
    fonts-dejavu-core \
    && curl -fsSL https://get.docker.com | sh \
    && curl -fsSL https://github.com/grafana/k6/releases/download/v0.49.0/k6-v0.49.0-linux-amd64.tar.gz \
        | tar -xz \
    && mv k6-v0.49.0-linux-amd64/k6 /usr/local/bin/k6 \
    && rm -rf k6-v0.49.0-linux-amd64 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ .
COPY k6/ /k6/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
