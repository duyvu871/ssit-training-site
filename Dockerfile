# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies required for Prisma and PostgreSQL client
RUN apk add --no-cache \
    openssl \
    openssl-dev \
    libc6-compat \
    postgresql-client \
    && apk add --no-cache --virtual builds-deps build-base python3

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Generate Prisma Client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Create uploads directory
RUN mkdir -p public/uploads

# Expose port
EXPOSE 3400

# Start the application
CMD ["npm", "start"] 