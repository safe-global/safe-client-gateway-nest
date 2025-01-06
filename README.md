# Safe Client Gateway

[![Coverage Status](https://coveralls.io/repos/github/safe-global/safe-client-gateway/badge.svg?branch=main)](https://coveralls.io/github/safe-global/safe-client-gateway?branch=main)

## Motivation

The Safe Client Gateway serves as a bridge for the Safe{Wallet} clients (Android, iOS, Web).

It provides UI-oriented mappings and data structures for easier integration with several Safe{Core} services. In essence, it works as a bridge between the frontend and backend, ensuring smooth, efficient data exchange.

## Documentation

- [Client Gateway OpenAPI specification](https://safe-client.safe.global/index.html)
- [Deploying the service](https://github.com/safe-global/safe-infrastructure)

## Requirements

- Node.js v22.12.0 'Jod' LTS ([Node.js Release Schedule](https://nodejs.org/en/about/previous-releases)) – https://nodejs.org/en/
- Docker Compose – https://docs.docker.com/compose/

## Installation

**Optional:** If you have NVM installed, you can run `nvm use` in the root folder of the project to use the recommended
Node version set for this project.

We use Yarn as the package manager for this project. Yarn is bundled with the project so to use it run:

```bash
corepack enable && yarn install
```

The project requires some ABIs that are generated after install. In order to manually generate them, run:

```bash
yarn generate-abis
```

## Running the app

1. Start Redis instance. By default, it will start on port `6379` of `localhost`.

```shell
docker compose up -d redis
```

2. Start the Safe Client Gateway

```bash
# development
yarn run start

# watch mode
yarn run start:dev

# production mode
yarn run start:prod
```

## Test

The unit test suite contains tests that require a database connection.
This project provides a `db-test` container which also validates the support for SSL connections.
To start the container, make sure that the key for the self-signed certificate
has the right permissions.

```shell
# disallow any access to world or group
chmod 0600 db_config/test/server.key
```

With the right permissions set on the `server.key` file we can now start the `db-test` container:

```shell
# start the db-test container
docker compose up -d db-test

# unit tests
yarn run test

# e2e tests
docker-compose up -d redis rabbitmq && yarn run test:e2e

# test coverage
yarn run test:cov
```

## Linter and Style Guide

We use [ESLint](https://eslint.org/) as a linter and [Prettier](https://prettier.io/) as a code formatter.
You can run `yarn run lint` to execute ESLint and `yarn run format` to execute Prettier.

These checks can be automatically executed using Git hooks. If you wish to install the provided git hooks:

```shell
yarn install
yarn husky install
```
