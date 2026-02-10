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

# --- A LINHA DA SOLUÇÃO ESTÁ AQUI ---
# Copia a pasta 'prisma' (com o schema.prisma) para a imagem final
COPY --from=builder /app/prisma ./prisma

# Expor a porta
EXPOSE 5000

# Comando para iniciar a aplicação
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
