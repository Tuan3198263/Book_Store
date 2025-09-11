FROM python:3.11-slim

WORKDIR /app

# Install system deps for pandas/numpy
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libatlas-base-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy app sources and model files
COPY . /app

EXPOSE 5001

# Use app_fix.py as entrypoint, run with gunicorn (1 worker to avoid high memory)
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:5001", "app_fix:app"]
