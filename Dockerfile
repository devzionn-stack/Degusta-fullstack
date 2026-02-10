# Estágio 1: Builder
# Este estágio instala todas as dependências e constrói o projeto.
FROM node:20-alpine AS builder

WORKDIR /app

# Copia os arquivos de definição de pacotes
COPY package*.json ./

# Instala todas as dependências (incluindo devDependencies para o build e prisma)
RUN npm install

# Copia todo o restante do código-fonte
COPY . .

# Executa o comando de build (se houver, como compilar TypeScript, etc.)
RUN npm run build


# Estágio 2: Final
# Este estágio cria a imagem final, mais leve, apenas com o necessário para rodar.
FROM node:20-alpine

WORKDIR /app

# Copia os artefatos construídos do estágio 'builder'
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# --- NOSSAS MODIFICAÇÕES ESTÃO AQUI ---

# 1. Copia o script de entrypoint para dentro da imagem final
COPY entrypoint.sh .

# 2. Garante que o script tenha permissão de execução
RUN chmod +x ./entrypoint.sh

# 3. Define o nosso script como o "ponto de entrada" do contêiner
ENTRYPOINT ["./entrypoint.sh"]

# --- FIM DAS MODIFICAÇÕES ---

# Expor a porta do backend
EXPOSE 5000

# Comando padrão que será passado para o nosso script de entrypoint
CMD ["npm", "start"]
