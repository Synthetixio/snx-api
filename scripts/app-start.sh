#!/bin/bash
home_path=/home/ubuntu
docker_path=$home_path/.docker/cli-plugins

export COMPOSE_HTTP_TIMEOUT=200

cd $home_path/snx-api &&
	$docker_path/docker-compose up -d
