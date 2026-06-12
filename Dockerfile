FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

# Tell the container not to download Chrome again, it's already built-in!
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

COPY package*.json ./
RUN npm install

COPY . .
CMD ["npm", "start"]