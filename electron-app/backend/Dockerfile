# Backend Dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables to avoid interactive prompts and improve stability
ENV DEBIAN_FRONTEND=noninteractive \
    APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies including Ruby, asciidoctor, and Java (for Saxon XSLT)
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    for i in 1 2 3 4 5; do \
        apt-get update --fix-missing && \
        apt-get install -y --no-install-recommends \
        pandoc \
        curl \
        ruby \
        ruby-dev \
        build-essential \
        gcc \
        g++ \
        make \
        default-jre-headless \
        && break || { \
            echo "Attempt $i failed, retrying in 10 seconds..."; \
            sleep 10; \
        }; \
    done && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    for i in 1 2 3; do \
        gem install asciidoctor --no-document && break || { \
            echo "Gem install attempt $i failed, retrying in 5 seconds..."; \
            sleep 5; \
        }; \
    done

# Verify installations
RUN which asciidoctor && asciidoctor --version && \
    which pandoc && pandoc --version && \
    which java && java -version && \
    which ruby && ruby --version

# Copy requirements first for better caching
COPY requirements.txt .

# Upgrade pip first, then install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --timeout=1000 --retries=5 -r requirements.txt gunicorn || \
    pip install --no-cache-dir --timeout=1000 --retries=5 --ignore-installed -r requirements.txt gunicorn

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port 8765
EXPOSE 8765

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8765/api/admin/features || exit 1

# Run the application with gunicorn for production (increased timeout for large files)
CMD ["gunicorn", "--bind", "0.0.0.0:8765", "--workers", "4", "--timeout", "600", "--graceful-timeout", "30", "app:app"]
