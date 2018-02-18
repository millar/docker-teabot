FROM node:9.5.0

CMD npm install -g yarn

WORKDIR /var/app/

# Install JS package dependencies
COPY package.json yarn.lock .
RUN yarn --pure-lockfile

COPY . .

# Boot app
CMD node src/app.js
