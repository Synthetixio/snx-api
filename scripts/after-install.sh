#!/bin/bash
home_path=/home/ubuntu
docker_path=$home_path/.docker/cli-plugins

cd $home_path/snx-api &&
	wget https://github.com/Droplr/aws-env/raw/9605a216913c18cf64338509204ca21379832b90/bin/aws-env-linux-amd64 -O aws-env &&
	chmod +x aws-env &&
	AWS_ENV_PATH=/snx-api/prod/api/ AWS_REGION=us-east-1 ./aws-env --format=dotenv >api.env &&
	AWS_ENV_PATH=/snx-api/prod/redis/ AWS_REGION=us-east-1 ./aws-env --format=dotenv >redis.env &&
	$docker_path/docker-compose build --no-cache
