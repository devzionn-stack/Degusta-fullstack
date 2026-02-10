# Estágio 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio 2: Final
FROM node:20-alpine
WORKDIR /app

# Copia os artefatos do estágio 'builder'
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma

# Expor a porta
EXPOSE 5000

# --- A LINHA DA SOLUÇÃO ESTÁ AQUI ---
# Comando para iniciar a aplicação, especificando o caminho do schema
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && npm start"]
