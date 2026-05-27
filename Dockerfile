FROM node:20-alpine
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY libs/shared/package.json ./libs/shared/

# Install all deps (prisma CLI needed at runtime for migrate deploy)
RUN npm ci

# Copy source
COPY libs/shared/ ./libs/shared/
COPY apps/api/ ./apps/api/

# Build
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npx nest build && ls -la dist/ && test -f dist/app.module.js

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
