#!/bin/bash

IMAGE_VERSION=v1.6
IMAGE=amaex/amanpuri-wallet:$IMAGE_VERSION

docker build -t $IMAGE -f Dockerfiledev .

# docker push $IMAGE

cd ../amanpuri-k8s
export CIRCLE_SHA1=$IMAGE_VERSION
envsubst < k8s/amanpuri-wallet/deployment.yml | kubectl apply -f -
