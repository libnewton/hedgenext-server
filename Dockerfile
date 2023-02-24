FROM node:16.19.1-bullseye-slim@sha256:97de7e6381540b593c55cd628a44ddffacdbadf9d3ba2f56b56f4913d8f95541 AS base

FROM base AS builder
# Build arguments to change source url, branch or tag

# Clone the source and remove git repository but keep the HEAD file
RUN apt-get update && apt-get install --no-install-recommends -y git jq ca-certificates python-is-python3 build-essential
COPY . /hedgedoc

# Install app dependencies and build
WORKDIR /hedgedoc
RUN yarn install --production=false --pure-lockfile
RUN yarn run build
RUN yarn install --production=true --pure-lockfile


FROM base
ARG UID=10000
ENV NODE_ENV=production
ENV UPLOADS_MODE=0700

RUN apt-get update && \
    apt-get install --no-install-recommends -y gosu && \
    rm -r /var/lib/apt/lists/*

# Create hedgedoc user
RUN adduser --uid $UID --home /hedgedoc/ --disabled-password --system hedgedoc

COPY --chown=$UID --from=builder /hedgedoc /hedgedoc

# Add configuraton files
COPY ["resources/config.json", "/files/"]

# Healthcheck
COPY --chown=$UID /resources/healthcheck.mjs /hedgedoc/healthcheck.mjs
HEALTHCHECK --interval=5s CMD node healthcheck.mjs

# For backwards compatibility
RUN ln -s /hedgedoc /codimd

# Symlink configuration files
RUN rm -f /hedgedoc/config.json
RUN ln -s /files/config.json /hedgedoc/config.json

WORKDIR /hedgedoc
EXPOSE 3000

COPY ["resources/docker-entrypoint.sh", "/usr/local/bin/docker-entrypoint.sh"]
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "app.js"]