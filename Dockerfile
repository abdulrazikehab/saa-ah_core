FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# Generate Prisma Client
RUN npm run prisma:generate

# Build NestJS app
RUN npm run build

EXPOSE 3002

CMD ["npm", "run", "start:prod"]
