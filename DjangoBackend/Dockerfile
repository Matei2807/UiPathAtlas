# Stage 1: The Builder -- Installs dependencies with build tools
FROM python:3.11 as builder

# Install build tools needed for some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libcairo2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .

# Install dependencies
RUN pip install --upgrade pip && pip install -r requirements.txt


# Stage 2: The Final Production Image -- Lean and clean
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
WORKDIR /app

# Copy only the installed packages from the builder stage
COPY --from=builder /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=builder /usr/local/bin/ /usr/local/bin/

# Copy your application code
COPY . .

EXPOSE 8000
ENV DJANGO_SETTINGS_MODULE=SmartTravel.settings
CMD ["gunicorn", "SmartTravel.asgi:application", "--bind", "0.0.0.0:8000", "--worker-class", "uvicorn.workers.UvicornWorker", "--workers", "3", "--timeout", "300"]