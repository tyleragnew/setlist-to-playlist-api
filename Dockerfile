FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY .doc.

RUN npm run build

CMD [ "npm", "run", "start" ]