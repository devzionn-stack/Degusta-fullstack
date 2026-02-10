# Estágio 1: Builder
# Este estágio instala todas as dependências e constrói o projeto.
FROM node:20-alpine AS builder

WORKDIR /app

# Copia os arquivos de definição de pacotes
COPY package*.json ./

# Instala todas as dependências
RUN npm install

# Copia todo o restante do código-fonte (incluindo o entrypoint.sh)
COPY . .

# Executa o comando de build
RUN npm run build


# Estágio 2: Final
# Este estágio cria a imagem final, mais leve.
FROM node:20-alpine

WORKDIR /app

# Copia os artefatos construídos do estágio 'builder'
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# --- CORREÇÃO ESTÁ AQUI ---
# Copia o script de entrypoint do estágio 'builder' para a imagem final
COPY --from=builder /app/entrypoint.sh .
# --- FIM DA CORREÇÃO ---

# Garante que o script tenha permissão de execução
RUN chmod +x ./entrypoint.sh

# Define o nosso script como o "ponto de entrada" do contêiner
ENTRYPOINT ["./entrypoint.sh"]

# Expor a porta do backend
EXPOSE 5000

# Comando padrão que será passado para o nosso script de entrypoint
CMD ["npm", "start"]
