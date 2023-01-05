FROM node:12.2.0-alpine

# Install all build dependencies
# Add bash for debugging purposes
RUN apk update && \
    apk add --no-cache --virtual build-dependencies build-base gcc g++ wget git python && \
    apk add bash

WORKDIR /app
COPY . ./

RUN npm i -g typescript typeorm

RUN make reinstall
RUN make rebuild

EXPOSE 9000

CMD ["tail", "-f", "/dev/null"]