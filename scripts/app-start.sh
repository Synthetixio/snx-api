#!/bin/bash
home_path=/home/ubuntu
docker_path=$home_path/.docker/cli-plugins

cd $home_path/snx-api &&
	COMPOSE_HTTP_TIMEOUT=200 $docker_path/docker-compose up -d
