#NoteTakingTs/backend/Dockerfile
FROM node:22
WORKDIR /app
COPY package*.json ./
ENV NODE_ENV=development
RUN npm install

RUN npm install -g typescript

COPY . .

RUN npm run build 


EXPOSE 3000
CMD [ "npm","start" ]