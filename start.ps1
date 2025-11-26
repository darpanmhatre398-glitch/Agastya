# Document Tools Suite - Docker Startup Script (Windows)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Document Tools Suite BETA v0.2" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "❌ Error: Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Check if docker-compose is available
$dockerCompose = Get-Command docker-compose -ErrorAction SilentlyContinue
if (-not $dockerCompose) {
    Write-Host "❌ Error: docker-compose not found. Please install docker-compose." -ForegroundColor Red
    exit 1
}

Write-Host "🔨 Building and starting containers..." -ForegroundColor Yellow
docker-compose up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Services started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 Access the application:" -ForegroundColor Cyan
    Write-Host "   Frontend: http://localhost:8888" -ForegroundColor White
    Write-Host "   Backend:  http://localhost:8080" -ForegroundColor White
    Write-Host "   Admin:    http://localhost:8888/admin" -ForegroundColor White
    Write-Host ""
    Write-Host "📊 Container status:" -ForegroundColor Cyan
    docker-compose ps
    Write-Host ""
    Write-Host "📋 View logs:" -ForegroundColor Cyan
    Write-Host "   docker-compose logs -f" -ForegroundColor White
    Write-Host ""
    Write-Host "🛑 Stop services:" -ForegroundColor Cyan
    Write-Host "   docker-compose down" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Error: Failed to start services" -ForegroundColor Red
    Write-Host "Check logs with: docker-compose logs" -ForegroundColor Yellow
    exit 1
}
