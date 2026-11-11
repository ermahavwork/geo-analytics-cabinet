FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Скрипты установки пакетов не выполняются: сборке они не нужны.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
