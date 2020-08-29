# Lisk SKD Scripts

Collection of scripts which I used as day-to-day activities.

## Setup

1. Copy latest configuration from SDK.
  
```bash
cp -r path/to/lisk-sdk/config .
```

2. Install dependencies

```bash
brew install jq
brew cask install homebrew/cask-versions/adoptopenjdk8
brew install swagger-codegen

export LISK_SDK_REPO_PATH=/path/to/sdk/repo
```

2. Generate latest API Clients


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
cd api_clients/lisk-http-api-client; yarn build;
cd lisk-forger-api-client; yarn build;
```
