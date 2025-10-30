FROM node:24-alpine AS builder

# Install necessary packages for Prisma and native modules
RUN apk add --no-cache \
    ca-certificates \
    libc6-compat \
    openssl

WORKDIR /app
COPY . .

RUN npm install
# Generate Prisma client for Alpine Linux
RUN npx prisma generate
# Remove CLI packages since we don't need them in production by default.
# Remove this line if you want to run CLI commands in your container.
RUN npm remove @shopify/cli
RUN npm run build
ENV NODE_ENV=production
# Unnecessary prune
RUN npm prune --production

# You'll probably want to remove this in production, it's here to make it easier to test things!
RUN rm -f prisma/dev.sqlite

# Second stage: create the final image
FROM node:24-alpine

# Install runtime dependencies for Prisma
RUN apk add --no-cache \
    ca-certificates \
    libc6-compat \
    openssl

WORKDIR /app
COPY --from=builder /app .

EXPOSE 3000
CMD ["npm", "run", "docker-start"]
