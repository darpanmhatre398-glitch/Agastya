#!/bin/bash

# Document Tools Suite - Docker Startup Script

echo "================================"
echo "Document Tools Suite BETA v0.2"
echo "================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose not found. Please install docker-compose."
    exit 1
fi

echo "🔨 Building and starting containers..."
docker-compose up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Services started successfully!"
    echo ""
    echo "📱 Access the application:"
    echo "   Frontend: http://localhost:8888"
    echo "   Backend:  http://localhost:8080"
    echo "   Admin:    http://localhost:8888/admin"
    echo ""
    echo "📊 Container status:"
    docker-compose ps
    echo ""
    echo "📋 View logs:"
    echo "   docker-compose logs -f"
    echo ""
    echo "🛑 Stop services:"
    echo "   docker-compose down"
else
    echo ""
    echo "❌ Error: Failed to start services"
    echo "Check logs with: docker-compose logs"
    exit 1
fi
