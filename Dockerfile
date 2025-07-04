#NoteTakingTs/backend/Dockerfile
FROM node:22
WORKDIR /app
COPY package*.json ./

RUN npm install -g typescript

COPY . .

RUN npm run build


EXPOSE 3000
CMD [ "npm","start" ]