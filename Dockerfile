# Usa uma imagem base completa do Node.js versão 20
FROM node:20

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos de definição de pacotes primeiro para otimizar o cache em builds futuros
COPY package*.json ./

# Instala TODAS as dependências, incluindo as de desenvolvimento (como o Prisma)
RUN npm install

# Copia TODO o restante do código-fonte para o diretório de trabalho
# Isso inclui a pasta 'prisma', o 'schema.prisma', e tudo mais.
COPY . .

# Executa o comando de build (para compilar TypeScript, etc.)
RUN npm run build

# Expor a porta que a aplicação usa
EXPOSE 5000

# Comando final para iniciar a aplicação.
# Especifica o caminho do schema para máxima robustez.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && npm start"]
