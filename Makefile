# Training Track Management System - Makefile

.PHONY: help dev dev-db dev-stop build up down logs clean install migrate seed

# Default target
help:
	@echo "Training Track Management System"
	@echo ""
	@echo "Available commands:"
	@echo "  make install     - Install dependencies"
	@echo "  make dev-db      - Start only database for development"
	@echo "  make dev         - Start development server (requires dev-db running)"
	@echo "  make dev-full    - Start database and development server"
	@echo "  make dev-stop    - Stop development database"
	@echo "  make build       - Build production Docker images"
	@echo "  make up          - Start production containers"
	@echo "  make down        - Stop all containers"
	@echo "  make logs        - Show container logs"
	@echo "  make migrate     - Run database migrations"
	@echo "  make seed        - Seed database with sample data"
	@echo "  make clean       - Clean up containers and volumes"

# Development workflow
install:
	npm install

dev-db:
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Database started on port 5444"
	@echo "Run 'make dev' in another terminal to start the server"

dev:
	NODE_ENV=development npm run dev

dev-full:
	npm run dev:full

dev-stop:
	docker-compose -f docker-compose.dev.yml down

# Production workflow
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

# Database operations
migrate:
	npx prisma migrate dev

seed:
	npx prisma db seed

# Cleanup
clean:
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v
	docker system prune -f 