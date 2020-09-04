# Lisk SKD Scripts

Collection of scripts which I used as day-to-day activities.

## Setup

1. Install dependencies

```bash
brew install jq
brew cask install homebrew/cask-versions/adoptopenjdk8
brew install swagger-codegen
```

2. Copy latest configuration from SDK.

```bash
export LISK_SDK_REPO_PATH=/path/to/sdk/repo
cp -r $LISK_SDK_REPO_PATH/config .
```

3. Generate latest API Clients

```bash
swagger-codegen generate \
  -i $LISK_SDK_REPO_PATH/framework-plugins/lisk-framework-http-api-plugin/swagger.yml \
  -l typescript-fetch \
  -o ./api_clients/lisk-http-api-client \
  -c ./api_clients/lisk-http-api-client-codegen.config.json \
  --disable-examples

swagger-codegen generate \
  -i $LISK_SDK_REPO_PATH/framework-plugins/lisk-framework-forger-plugin/swagger.yml \
  -l typescript-fetch \
  -o ./api_clients/lisk-forger-api-client \
  -c ./api_clients/lisk-forger-api-client-codegen.config.json \
  --disable-examples

yarn
cd api_clients/lisk-http-api-client; ../../node_modules/.bin/tsc;
cd api_clients/lisk-forger-api-client; ../../node_modules/.bin/tsc;
```

Note: Its required to use `tsc` from main folder due to version issue with auto-generated package.json file.
