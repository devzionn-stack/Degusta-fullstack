FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json ./

# Instalar dependências (incluindo devDependencies para o build)
RUN npm install

# Copiar o restante do código
COPY . .

# Build do projeto (frontend e backend)
RUN npm run build

# Estágio final
FROM node:20-alpine

WORKDIR /app

# Copiar apenas o necessário do estágio de build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/server/rls-setup.sql ./server/rls-setup.sql

# Expor a porta do backend
EXPOSE 5000

# Comando para iniciar a aplicação
CMD ["npm", "start"]
