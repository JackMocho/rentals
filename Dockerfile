# backend/Dockerfile

FROM node:18-alpine

WORKDIR /app

# Install dotenvx CLI
RUN curl -fsS https://dotenvx.sh  | sh

# Copy encrypted .env + keys
COPY .env.encrypted .env.keys ./



# Remove unencrypted .env files before build
RUN dotenvx ext prebuild

# Copy source code
COPY . .

# Start app with runtime env loading
CMD ["dotenvx", "run", "--", "node", "server.js"]