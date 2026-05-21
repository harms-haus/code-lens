FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s CMD wget -q --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
