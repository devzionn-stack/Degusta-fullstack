# 1. Imagem base
FROM node:20

# 2. Diretório de trabalho
WORKDIR /app

# 3. Copia apenas os arquivos de dependências primeiro (Otimização de Cache)
COPY package*.json ./
# Se você tiver a pasta prisma, copie-a agora para gerar o client
COPY prisma ./prisma/

# 4. Instala as dependências
RUN npm install

# 5. GERA O PRISMA CLIENT (O passo que faltava!)
# Isso cria os tipos e o código necessário para o Prisma funcionar
RUN npx prisma generate

# 6. Agora sim, copia o restante do código
COPY . .

# 7. Build da aplicação (TypeScript -> JS)
RUN npm run build

# 8. Porta e Comando Final
EXPOSE 5000

# Dica de Sênior: Use 'npx prisma generate' novamente no CMD para garantir 
# que o client esteja atualizado com o schema final se houver mudanças.
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
