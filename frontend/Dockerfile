FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json /app/package.json
# If you later add a lockfile, switch to `npm ci`
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY . /app

# Inject public API base URL at build time for client code
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NODE_ENV=production
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public /app/public
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/next.config.js /app/next.config.js

EXPOSE 3000
CMD ["npm", "run", "start"]
